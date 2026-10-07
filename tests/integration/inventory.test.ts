import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { createApp } from '../../apps/api/src/app';
import { applicationModels } from '../../apps/api/src/infrastructure/models';
import { buildIdentityDeps } from '../../apps/api/src/modules/identity/presentation/routes';
import { TenantModel } from '../../apps/api/src/modules/tenant/infrastructure/models';
import type { IEmailProvider } from '../../apps/api/src/modules/notifications/domain/ports';
import { AuditEventModel, MembershipModel, RoleModel, UserModel } from '../../apps/api/src/modules/identity/infrastructure/models';
import { CategoryModel, ProductModel, WarehouseModel } from '../../apps/api/src/modules/inventory/infrastructure/models';
import type { Express } from 'express';

let mongod: MongoMemoryReplSet;
let app: Express;

const TENANT_A = 'TENANT_A';
const TENANT_B = 'TENANT_B';

let adminAccessA = '';
let viewerAccessA = '';
let adminAccessB = '';
let categoryIdA = '';
let productIdA = '';
let productVersionA = 1;
let productIdB = '';

async function registerCompany(companyName: string, email: string) {
  const res = await request(app).post('/api/v1/auth/register').send({
    companyName,
    username: email.split('@')[0] ?? email,
    email,
    password: 'Password123',
  });
  expect(res.status).toBe(201);
  return res.body.data as { accessToken: string; tenantId: string };
}

describe('Inventory integration: catalog + isolation + permissions + audit', () => {
  const testEmailProvider: IEmailProvider = {
    async sendWelcomeEmail() {},
  };
  beforeAll(async () => {
    // Local Atlas verification: TEST_MONGO_URI skips mongodb-memory-server
    // (binary download unavailable in this environment).
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      process.env.MONGODB_URI = mongod.getUri();
    }
    process.env.MONGODB_DATABASE = 'test_inventory';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'integration-test-secret-32-chars-min!!';
    process.env.BCRYPT_ROUNDS = '4';
    // Local .env placeholders fail strict validation; drop them for the test process.
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.RESEND_API_KEY;
    __resetConfigForTests();
    await disconnectMongo().catch(() => {});
    await connectMongo();
    await ensureIndexes(applicationModels);
    // Clean slate: Atlas persists between runs (memory server does not).
    const cleanModels: Array<{ deleteMany(filter: object): { exec(): Promise<unknown> } }> = [
      UserModel,
      RoleModel,
      MembershipModel,
      AuditEventModel,
      CategoryModel,
      ProductModel,
      WarehouseModel,
    ];
    for (const model of cleanModels) {
      await model.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    }
    const deps = buildIdentityDeps(testEmailProvider);
    // Login requires an ACTIVE tenant document (see c9e2b40).
    await TenantModel.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    await deps.tenants.create({ tenantId: TENANT_A, name: 'Tenant A', slug: 'tenant-a-inventory-test', createdBy: 'test' });
    await deps.tenants.create({ tenantId: TENANT_B, name: 'Tenant B', slug: 'tenant-b-inventory-test', createdBy: 'test' });
    app = createApp(deps);

    // Tenant A: admin (all permissions) + viewer (inventory.read only)
    const adminRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'admin', permissions: ['system.users.read', 'system.users.write', 'inventory.read', 'inventory.create', 'inventory.update', 'inventory.delete'], createdBy: 'test' });
    const adminHash = await deps.hasher.hash('AdminPass1');
    const adminA = await deps.users.create({ tenantId: TENANT_A, username: 'admina', email: 'admin@a.mx', passwordHash: adminHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: adminA._id, roleIds: [adminRoleA._id], createdBy: 'test' });
    const viewerRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'viewer', permissions: ['inventory.read'], createdBy: 'test' });
    const viewerHash = await deps.hasher.hash('ViewerPass1');
    const viewerA = await deps.users.create({ tenantId: TENANT_A, username: 'viewera', email: 'viewer@a.mx', passwordHash: viewerHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: viewerA._id, roleIds: [viewerRoleA._id], createdBy: 'test' });
    // Tenant B: admin only
    const adminRoleB = await deps.roles.create({ tenantId: TENANT_B, name: 'admin', permissions: ['inventory.read', 'inventory.create', 'inventory.update', 'inventory.delete'], createdBy: 'test' });
    const adminHashB = await deps.hasher.hash('AdminPass2');
    const adminB = await deps.users.create({ tenantId: TENANT_B, username: 'adminb', email: 'admin@b.mx', passwordHash: adminHashB, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_B, userId: adminB._id, roleIds: [adminRoleB._id], createdBy: 'test' });

    const loginA = await request(app).post('/api/v1/auth/login').send({ email: 'admin@a.mx', password: 'AdminPass1' });
    adminAccessA = loginA.body.data.accessToken as string;
    const loginViewer = await request(app).post('/api/v1/auth/login').send({ email: 'viewer@a.mx', password: 'ViewerPass1' });
    viewerAccessA = loginViewer.body.data.accessToken as string;
    const loginB = await request(app).post('/api/v1/auth/login').send({ email: 'admin@b.mx', password: 'AdminPass2' });
    adminAccessB = loginB.body.data.accessToken as string;
  }, 90000);

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('requires authentication on inventory routes', async () => {
    const res = await request(app).get('/api/v1/inventory/products');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates category, warehouse and product (201, no secrets leaked)', async () => {
    const category = await request(app)
      .post('/api/v1/inventory/categories')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ name: 'Telas', description: 'Tejidos' });
    expect(category.status).toBe(201);
    categoryIdA = category.body.data._id as string;

    const warehouse = await request(app)
      .post('/api/v1/inventory/warehouses')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'alm-mx-01', name: 'Principal' });
    expect(warehouse.status).toBe(201);
    expect(warehouse.body.data.code).toBe('ALM-MX-01');

    const product = await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ sku: 'tx-001', name: 'Tela', unit: 'm', cost: 10, price: 20, minimumStock: 5, categoryId: categoryIdA });
    expect(product.status).toBe(201);
    expect(product.body.data.sku).toBe('TX-001');
    expect(JSON.stringify(product.body)).not.toContain('passwordHash');
    productIdA = product.body.data._id as string;
    productVersionA = product.body.data.version as number;
  });

  it('rejects duplicate SKU in the same tenant but allows it in another tenant', async () => {
    const dup = await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ sku: 'TX-001', name: 'Otra', unit: 'm', cost: 1, price: 2, minimumStock: 0 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');

    const other = await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminAccessB}`)
      .send({ sku: 'tx-001', name: 'Tela B', unit: 'm', cost: 1, price: 2, minimumStock: 0 });
    expect(other.status).toBe(201);
    productIdB = other.body.data._id as string;
  });

  it('isolates tenants: A cannot read, update or delete B resources', async () => {
    const get = await request(app).get(`/api/v1/inventory/products/${productIdB}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(get.status).toBe(404);
    const patch = await request(app)
      .patch(`/api/v1/inventory/products/${productIdB}`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ name: 'Hack', expectedVersion: 1 });
    expect(patch.status).toBe(404);
    const del = await request(app).delete(`/api/v1/inventory/products/${productIdB}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(del.status).toBe(404);
  });

  it('lists with search, filters and pagination meta', async () => {
    const list = await request(app).get('/api/v1/inventory/products?search=tela&page=1&limit=10').set('Authorization', `Bearer ${adminAccessA}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].sku).toBe('TX-001');

    const byCategory = await request(app)
      .get(`/api/v1/inventory/products?categoryId=${categoryIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`);
    expect(byCategory.body.meta.total).toBe(1);

    const otherCategory = await request(app)
      .get('/api/v1/inventory/products?categoryId=000000000000000000000000')
      .set('Authorization', `Bearer ${adminAccessA}`);
    expect(otherCategory.status).toBe(404);
  });

  it('rejects unknown sort fields and unknown body fields', async () => {
    const sort = await request(app).get('/api/v1/inventory/products?sortBy=$where').set('Authorization', `Bearer ${adminAccessA}`);
    expect(sort.status).toBe(400);
    expect(sort.body.error.code).toBe('VALIDATION_ERROR');

    const extra = await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ sku: 'X-1', name: 'X', unit: 'm', cost: 1, price: 2, minimumStock: 0, tenantId: 'TENANT_B' });
    expect(extra.status).toBe(400);
  });

  it('enforces permissions: viewer can read but not write', async () => {
    const read = await request(app).get('/api/v1/inventory/products').set('Authorization', `Bearer ${viewerAccessA}`);
    expect(read.status).toBe(200);
    const write = await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${viewerAccessA}`)
      .send({ sku: 'V-1', name: 'V', unit: 'm', cost: 1, price: 2, minimumStock: 0 });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
    const del = await request(app).delete(`/api/v1/inventory/products/${productIdA}`).set('Authorization', `Bearer ${viewerAccessA}`);
    expect(del.status).toBe(403);
  });

  it('updates with optimistic concurrency and deactivates logically', async () => {
    const stale = await request(app)
      .patch(`/api/v1/inventory/products/${productIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ price: 99, expectedVersion: productVersionA + 100 });
    expect(stale.status).toBe(409);

    const updated = await request(app)
      .patch(`/api/v1/inventory/products/${productIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ price: 25, expectedVersion: productVersionA });
    expect(updated.status).toBe(200);
    expect(updated.body.data.price).toBe(25);

    const deactivated = await request(app).delete(`/api/v1/inventory/products/${productIdA}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.status).toBe('INACTIVE');

    const stillThere = await request(app).get(`/api/v1/inventory/products/${productIdA}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.data.status).toBe('INACTIVE');
  });

  it('blocks category deactivation while active products reference it', async () => {
    const category = await request(app)
      .post('/api/v1/inventory/categories')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ name: 'Hilos' });
    const catId = category.body.data._id as string;
    await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ sku: 'H-1', name: 'Hilo', unit: 'm', cost: 1, price: 2, minimumStock: 0, categoryId: catId });
    const blocked = await request(app).delete(`/api/v1/inventory/categories/${catId}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CONFLICT');
  });

  it('records audit events for mutations', async () => {
    const created = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'inventory.product.created' }).exec();
    expect(created).toBeGreaterThan(0);
    const updated = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'inventory.product.updated' }).exec();
    expect(updated).toBeGreaterThan(0);
    const deactivated = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'inventory.product.deactivated' }).exec();
    expect(deactivated).toBeGreaterThan(0);
    const sample = await AuditEventModel.findOne({ tenantId: TENANT_A, action: 'inventory.product.created' }).lean().exec();
    expect(JSON.stringify(sample)).not.toContain('passwordHash');
  });

  it('registers an isolated company end to end', async () => {
    const data = await registerCompany('Acme Vertical', `owner.${Date.now()}@acme.mx`);
    expect(data.tenantId).toMatch(/^tnt_[0-9a-f]{16}$/);
    const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.permissions).toContain('inventory.create');
  });
});
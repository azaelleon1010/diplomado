import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { createApp } from '../../apps/api/src/app';
import { applicationModels } from '../../apps/api/src/infrastructure/models';
import { buildIdentityDeps } from '../../apps/api/src/modules/identity/presentation/routes';
import { TenantModel } from '../../apps/api/src/modules/tenant/infrastructure/models';
import type { IEmailProvider } from '../../apps/api/src/modules/notifications/domain/ports';
import { AuditEventModel, MembershipModel, RoleModel, UserModel } from '../../apps/api/src/modules/identity/infrastructure/models';
import { CategoryModel, ProductModel } from '../../apps/api/src/modules/inventory/infrastructure/models';
import { ProductionOrderModel } from '../../apps/api/src/modules/production/infrastructure/models';
import type { Express } from 'express';

let mongod: MongoMemoryServer;
let app: Express;

const TENANT_A = 'TENANT_A';
const TENANT_B = 'TENANT_B';

let adminAccessA = '';
let viewerAccessA = '';
let adminAccessB = '';
let productIdA = '';
let materialIdA = '';
let orderIdA = '';
let orderVersionA = 0;

describe('Production integration: orders + catalog reuse + isolation + permissions + audit', () => {
  const testEmailProvider: IEmailProvider = {
    async sendWelcomeEmail() {},
  };
  beforeAll(async () => {
    // Local Atlas verification: TEST_MONGO_URI skips mongodb-memory-server
    // (binary download unavailable in this environment).
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      mongod = await MongoMemoryServer.create();
      process.env.MONGODB_URI = mongod.getUri();
    }
    process.env.MONGODB_DATABASE = 'test_production';
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
      ProductionOrderModel,
    ];
    for (const model of cleanModels) {
      await model.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    }
    const deps = buildIdentityDeps(testEmailProvider);
    // Login requires an ACTIVE tenant document (see c9e2b40).
    await TenantModel.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    await deps.tenants.create({ tenantId: TENANT_A, name: 'Tenant A', slug: 'tenant-a-production-test', createdBy: 'test' });
    await deps.tenants.create({ tenantId: TENANT_B, name: 'Tenant B', slug: 'tenant-b-production-test', createdBy: 'test' });
    app = createApp(deps);

    const perms = ['production.read', 'production.create', 'production.update', 'production.delete', 'inventory.read', 'inventory.create'];
    const adminRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'admin', permissions: perms, createdBy: 'test' });
    const adminHash = await deps.hasher.hash('AdminPass1');
    const adminA = await deps.users.create({ tenantId: TENANT_A, username: 'admina', email: 'admin@a.mx', passwordHash: adminHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: adminA._id, roleIds: [adminRoleA._id], createdBy: 'test' });
    const viewerRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'viewer', permissions: ['production.read'], createdBy: 'test' });
    const viewerHash = await deps.hasher.hash('ViewerPass1');
    const viewerA = await deps.users.create({ tenantId: TENANT_A, username: 'viewera', email: 'viewer@a.mx', passwordHash: viewerHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: viewerA._id, roleIds: [viewerRoleA._id], createdBy: 'test' });
    const adminRoleB = await deps.roles.create({ tenantId: TENANT_B, name: 'admin', permissions: perms, createdBy: 'test' });
    const adminHashB = await deps.hasher.hash('AdminPass2');
    const adminB = await deps.users.create({ tenantId: TENANT_B, username: 'adminb', email: 'admin@b.mx', passwordHash: adminHashB, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_B, userId: adminB._id, roleIds: [adminRoleB._id], createdBy: 'test' });

    const loginA = await request(app).post('/api/v1/auth/login').send({ email: 'admin@a.mx', password: 'AdminPass1' });
    adminAccessA = loginA.body.data.accessToken as string;
    const loginViewer = await request(app).post('/api/v1/auth/login').send({ email: 'viewer@a.mx', password: 'ViewerPass1' });
    viewerAccessA = loginViewer.body.data.accessToken as string;
    const loginB = await request(app).post('/api/v1/auth/login').send({ email: 'admin@b.mx', password: 'AdminPass2' });
    adminAccessB = loginB.body.data.accessToken as string;

    // Catalog fixtures live in inventory (reused, never duplicated).
    const fg = await request(app).post('/api/v1/inventory/products').set('Authorization', `Bearer ${adminAccessA}`).send({ sku: 'FG-100', name: 'Silla', unit: 'pza', cost: 100, price: 250, minimumStock: 0 });
    productIdA = fg.body.data._id as string;
    const mat = await request(app).post('/api/v1/inventory/products').set('Authorization', `Bearer ${adminAccessA}`).send({ sku: 'MAT-10', name: 'Madera', unit: 'm', cost: 10, price: 20, minimumStock: 0 });
    materialIdA = mat.body.data._id as string;
  }, 90000);

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('requires authentication on production routes', async () => {
    const res = await request(app).get('/api/v1/production/orders');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates an order from the inventory catalog (201)', async () => {
    const res = await request(app)
      .post('/api/v1/production/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'ot-001', productId: productIdA, quantity: 50, machine: 'Línea 1', materials: [{ productId: materialIdA, quantityRequired: 4 }] });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('OT-001');
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.materials).toEqual([{ productId: materialIdA, quantityRequired: 4, quantityConsumed: 0 }]);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    orderIdA = res.body.data._id as string;
    orderVersionA = res.body.data.version as number;
  });

  it('rejects unknown products, duplicates and bad quantities', async () => {
    const missing = await request(app)
      .post('/api/v1/production/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'OT-002', productId: '000000000000000000000000', quantity: 10 });
    expect(missing.status).toBe(404);

    const dup = await request(app)
      .post('/api/v1/production/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'OT-001', productId: productIdA, quantity: 10 });
    expect(dup.status).toBe(409);

    const zero = await request(app)
      .post('/api/v1/production/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'OT-003', productId: productIdA, quantity: 0 });
    expect(zero.status).toBe(400);
  });

  it('isolates tenants end to end', async () => {
    const get = await request(app).get(`/api/v1/production/orders/${orderIdA}`).set('Authorization', `Bearer ${adminAccessB}`);
    expect(get.status).toBe(404);
    const list = await request(app).get('/api/v1/production/orders').set('Authorization', `Bearer ${adminAccessB}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(0);
    // Cross-tenant product reference is rejected (catalog is tenant-scoped).
    const cross = await request(app)
      .post('/api/v1/production/orders')
      .set('Authorization', `Bearer ${adminAccessB}`)
      .send({ code: 'OT-B1', productId: productIdA, quantity: 5 });
    expect(cross.status).toBe(404);
  });

  it('enforces permissions: viewer reads but cannot write', async () => {
    const read = await request(app).get('/api/v1/production/orders').set('Authorization', `Bearer ${viewerAccessA}`);
    expect(read.status).toBe(200);
    const write = await request(app)
      .post('/api/v1/production/orders')
      .set('Authorization', `Bearer ${viewerAccessA}`)
      .send({ code: 'OT-V1', productId: productIdA, quantity: 5 });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
  });

  it('runs release → start → complete with consumption snapshot', async () => {
    const released = await request(app)
      .post(`/api/v1/production/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'RELEASED', expectedVersion: orderVersionA });
    expect(released.status).toBe(200);
    orderVersionA = released.body.data.version as number;

    const started = await request(app)
      .post(`/api/v1/production/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'IN_PROGRESS', expectedVersion: orderVersionA });
    expect(started.status).toBe(200);
    expect(started.body.data.startedAt).toBeTruthy();
    orderVersionA = started.body.data.version as number;

    const done = await request(app)
      .post(`/api/v1/production/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'COMPLETED', expectedVersion: orderVersionA, producedQuantity: 48 });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.producedQuantity).toBe(48);
    expect(done.body.data.materials).toEqual([{ productId: materialIdA, quantityRequired: 4, quantityConsumed: 4 }]);
    expect(done.body.data.completedAt).toBeTruthy();
  });

  it('records audit events for the lifecycle', async () => {
    const created = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'production.order.created' }).exec();
    expect(created).toBeGreaterThan(0);
    const completed = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'production.order.completed' }).exec();
    expect(completed).toBeGreaterThan(0);
  });
});

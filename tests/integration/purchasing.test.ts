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
import { PurchaseOrderModel, SupplierModel } from '../../apps/api/src/modules/purchasing/infrastructure/models';
import type { Express } from 'express';

let mongod: MongoMemoryServer;
let app: Express;

const TENANT_A = 'TENANT_A';
const TENANT_B = 'TENANT_B';

let adminAccessA = '';
let viewerAccessA = '';
let adminAccessB = '';
let supplierIdA = '';
let productIdA = '';
let materialIdA = '';
let orderIdA = '';
let orderVersionA = 0;

describe('Purchasing integration: suppliers + orders + isolation + permissions + audit', () => {
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
    process.env.MONGODB_DATABASE = 'test_purchasing';
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
      SupplierModel,
      PurchaseOrderModel,
    ];
    for (const model of cleanModels) {
      await model.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    }
    const deps = buildIdentityDeps(testEmailProvider);
    // Login requires an ACTIVE tenant document (see c9e2b40).
    await TenantModel.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    await deps.tenants.create({ tenantId: TENANT_A, name: 'Tenant A', slug: 'tenant-a-purchasing-test', createdBy: 'test' });
    await deps.tenants.create({ tenantId: TENANT_B, name: 'Tenant B', slug: 'tenant-b-purchasing-test', createdBy: 'test' });
    app = createApp(deps);

    const perms = ['purchasing.read', 'purchasing.create', 'purchasing.update', 'purchasing.delete', 'inventory.read', 'inventory.create'];
    const adminRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'admin', permissions: perms, createdBy: 'test' });
    const adminHash = await deps.hasher.hash('AdminPass1');
    const adminA = await deps.users.create({ tenantId: TENANT_A, username: 'admina', email: 'admin@a.mx', passwordHash: adminHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: adminA._id, roleIds: [adminRoleA._id], createdBy: 'test' });
    const viewerRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'viewer', permissions: ['purchasing.read'], createdBy: 'test' });
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
    const fg = await request(app).post('/api/v1/inventory/products').set('Authorization', `Bearer ${adminAccessA}`).send({ sku: 'FG-900', name: 'Tornillo', unit: 'pza', cost: 1, price: 3, minimumStock: 0 });
    productIdA = fg.body.data._id as string;
    const mat = await request(app).post('/api/v1/inventory/products').set('Authorization', `Bearer ${adminAccessA}`).send({ sku: 'MAT-90', name: 'Acero', unit: 'kg', cost: 5, price: 9, minimumStock: 0 });
    materialIdA = mat.body.data._id as string;
  }, 90000);

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('requires authentication on purchasing routes', async () => {
    const res = await request(app).get('/api/v1/purchasing/suppliers');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates supplier and order with server-computed subtotal', async () => {
    const supplier = await request(app)
      .post('/api/v1/purchasing/suppliers')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'tn-01', name: 'Textiles del Norte', email: 'contacto@textiles.mx' });
    expect(supplier.status).toBe(201);
    expect(supplier.body.data.code).toBe('TN-01');
    supplierIdA = supplier.body.data._id as string;

    const order = await request(app)
      .post('/api/v1/purchasing/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({
        folio: 'oc-1001',
        supplierId: supplierIdA,
        lines: [
          { productId: productIdA, quantity: 10, unitCost: 2.5 },
          { productId: materialIdA, quantity: 4, unitCost: 5 },
        ],
      });
    expect(order.status).toBe(201);
    expect(order.body.data.folio).toBe('OC-1001');
    expect(order.body.data.status).toBe('DRAFT');
    expect(order.body.data.subtotal).toBe(45);
    expect(JSON.stringify(order.body)).not.toContain('passwordHash');
    orderIdA = order.body.data._id as string;
    orderVersionA = order.body.data.version as number;
  });

  it('rejects duplicates, unknown references and bad lines', async () => {
    const dupSupplier = await request(app)
      .post('/api/v1/purchasing/suppliers')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'TN-01', name: 'Otro' });
    expect(dupSupplier.status).toBe(409);

    const dupFolio = await request(app)
      .post('/api/v1/purchasing/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ folio: 'OC-1001', supplierId: supplierIdA, lines: [{ productId: productIdA, quantity: 1, unitCost: 1 }] });
    expect(dupFolio.status).toBe(409);

    const badSupplier = await request(app)
      .post('/api/v1/purchasing/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ folio: 'OC-1002', supplierId: '000000000000000000000000', lines: [{ productId: productIdA, quantity: 1, unitCost: 1 }] });
    expect(badSupplier.status).toBe(404);

    const badProduct = await request(app)
      .post('/api/v1/purchasing/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ folio: 'OC-1003', supplierId: supplierIdA, lines: [{ productId: '000000000000000000000000', quantity: 1, unitCost: 1 }] });
    expect(badProduct.status).toBe(404);

    const empty = await request(app)
      .post('/api/v1/purchasing/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ folio: 'OC-1004', supplierId: supplierIdA, lines: [] });
    expect(empty.status).toBe(400);
  });

  it('isolates tenants end to end', async () => {
    const get = await request(app).get(`/api/v1/purchasing/orders/${orderIdA}`).set('Authorization', `Bearer ${adminAccessB}`);
    expect(get.status).toBe(404);
    const list = await request(app).get('/api/v1/purchasing/suppliers').set('Authorization', `Bearer ${adminAccessB}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(0);
  });

  it('enforces permissions: viewer reads but cannot write', async () => {
    const read = await request(app).get('/api/v1/purchasing/orders').set('Authorization', `Bearer ${viewerAccessA}`);
    expect(read.status).toBe(200);
    const write = await request(app)
      .post('/api/v1/purchasing/suppliers')
      .set('Authorization', `Bearer ${viewerAccessA}`)
      .send({ code: 'X-1', name: 'X' });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
  });

  it('runs send → approve → partial → full reception with alerts-worthy events', async () => {
    const sent = await request(app)
      .post(`/api/v1/purchasing/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'SENT', expectedVersion: orderVersionA });
    expect(sent.status).toBe(200);
    orderVersionA = sent.body.data.version as number;

    const approved = await request(app)
      .post(`/api/v1/purchasing/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'APPROVED', expectedVersion: orderVersionA });
    expect(approved.status).toBe(200);
    orderVersionA = approved.body.data.version as number;

    const over = await request(app)
      .post(`/api/v1/purchasing/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'RECEIVED', expectedVersion: orderVersionA, lines: [{ productId: productIdA, quantityReceived: 999 }] });
    expect(over.status).toBe(400);

    const partial = await request(app)
      .post(`/api/v1/purchasing/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'PARTIALLY_RECEIVED', expectedVersion: orderVersionA, lines: [{ productId: productIdA, quantityReceived: 6 }, { productId: materialIdA, quantityReceived: 4 }] });
    expect(partial.status).toBe(200);
    expect(partial.body.data.status).toBe('PARTIALLY_RECEIVED');
    orderVersionA = partial.body.data.version as number;

    const done = await request(app)
      .post(`/api/v1/purchasing/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'RECEIVED', expectedVersion: orderVersionA, lines: [{ productId: productIdA, quantityReceived: 10 }, { productId: materialIdA, quantityReceived: 4 }] });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('RECEIVED');
    expect(done.body.data.receivedAt).toBeTruthy();
  });

  it('records audit events for mutations', async () => {
    const created = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'purchasing.order.created' }).exec();
    expect(created).toBeGreaterThan(0);
    const received = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'purchasing.order.received' }).exec();
    expect(received).toBeGreaterThan(0);
    const supplierCreated = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'purchasing.supplier.created' }).exec();
    expect(supplierCreated).toBeGreaterThan(0);
  });
});

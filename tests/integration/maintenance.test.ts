import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { createApp } from '../../apps/api/src/app';
import { applicationModels } from '../../apps/api/src/infrastructure/models';
import { buildIdentityDeps } from '../../apps/api/src/modules/identity/presentation/routes';
import { AuditEventModel, MembershipModel, RoleModel, UserModel } from '../../apps/api/src/modules/identity/infrastructure/models';
import type { IEmailProvider } from '../../apps/api/src/modules/notifications/domain/ports';
import { AssetModel, MaintenanceOrderModel } from '../../apps/api/src/modules/maintenance/infrastructure/models';
import type { Express } from 'express';

let mongod: MongoMemoryServer;
let app: Express;

const TENANT_A = 'TENANT_A';
const TENANT_B = 'TENANT_B';

let adminAccessA = '';
let viewerAccessA = '';
let adminAccessB = '';
let assetIdA = '';
let orderIdA = '';
let orderVersionA = 0;

describe('Maintenance integration: assets + orders + isolation + permissions + audit', () => {
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
    process.env.MONGODB_DATABASE = 'test_maintenance';
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
      AssetModel,
      MaintenanceOrderModel,
    ];
    for (const model of cleanModels) {
      await model.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    }
    const deps = buildIdentityDeps(testEmailProvider);
    app = createApp(deps);

    // Tenant A: admin (all maintenance perms) + viewer (maintenance.read only)
    const adminRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'admin', permissions: ['maintenance.read', 'maintenance.create', 'maintenance.update', 'maintenance.delete'], createdBy: 'test' });
    const adminHash = await deps.hasher.hash('AdminPass1');
    const adminA = await deps.users.create({ tenantId: TENANT_A, username: 'admina', email: 'admin@a.mx', passwordHash: adminHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: adminA._id, roleIds: [adminRoleA._id], createdBy: 'test' });
    const viewerRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'viewer', permissions: ['maintenance.read'], createdBy: 'test' });
    const viewerHash = await deps.hasher.hash('ViewerPass1');
    const viewerA = await deps.users.create({ tenantId: TENANT_A, username: 'viewera', email: 'viewer@a.mx', passwordHash: viewerHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: viewerA._id, roleIds: [viewerRoleA._id], createdBy: 'test' });
    // Tenant B: admin only
    const adminRoleB = await deps.roles.create({ tenantId: TENANT_B, name: 'admin', permissions: ['maintenance.read', 'maintenance.create', 'maintenance.update', 'maintenance.delete'], createdBy: 'test' });
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

  it('requires authentication on maintenance routes', async () => {
    const res = await request(app).get('/api/v1/maintenance/assets');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates asset and order (201, codes normalized)', async () => {
    const asset = await request(app)
      .post('/api/v1/maintenance/assets')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'hil-04', name: 'Hiladora 4', type: 'Hiladora', location: 'Planta A' });
    expect(asset.status).toBe(201);
    expect(asset.body.data.code).toBe('HIL-04');
    expect(JSON.stringify(asset.body)).not.toContain('passwordHash');
    assetIdA = asset.body.data._id as string;

    const order = await request(app)
      .post('/api/v1/maintenance/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ assetId: assetIdA, type: 'CORRECTIVE', priority: 'HIGH', title: 'Banda rota' });
    expect(order.status).toBe(201);
    expect(order.body.data.status).toBe('OPEN');
    orderIdA = order.body.data._id as string;
    orderVersionA = order.body.data.version as number;
  });

  it('rejects duplicate asset codes per tenant but allows across tenants', async () => {
    const dup = await request(app)
      .post('/api/v1/maintenance/assets')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'HIL-04', name: 'Otra', type: 'Torno' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('CONFLICT');

    const other = await request(app)
      .post('/api/v1/maintenance/assets')
      .set('Authorization', `Bearer ${adminAccessB}`)
      .send({ code: 'hil-04', name: 'Hiladora B', type: 'Hiladora' });
    expect(other.status).toBe(201);
  });

  it('rejects orders for unknown assets and invalid transitions', async () => {
    const missing = await request(app)
      .post('/api/v1/maintenance/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ assetId: '000000000000000000000000', type: 'CORRECTIVE', priority: 'HIGH', title: 'Orden fantasma' });
    expect(missing.status).toBe(404);

    const bad = await request(app)
      .post(`/api/v1/maintenance/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'COMPLETED', expectedVersion: orderVersionA });
    expect(bad.status).toBe(400);
  });

  it('runs the full order lifecycle and syncs asset status', async () => {
    const started = await request(app)
      .post(`/api/v1/maintenance/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'IN_PROGRESS', expectedVersion: orderVersionA });
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('IN_PROGRESS');
    orderVersionA = started.body.data.version as number;

    const asset = await request(app).get(`/api/v1/maintenance/assets/${assetIdA}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(asset.body.data.status).toBe('IN_MAINTENANCE');

    const done = await request(app)
      .post(`/api/v1/maintenance/orders/${orderIdA}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'COMPLETED', expectedVersion: orderVersionA, completedCost: 250 });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('COMPLETED');
    expect(done.body.data.cost).toBe(250);

    const back = await request(app).get(`/api/v1/maintenance/assets/${assetIdA}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(back.body.data.status).toBe('ACTIVE');
  });

  it('isolates tenants: B cannot touch A resources', async () => {
    const get = await request(app).get(`/api/v1/maintenance/orders/${orderIdA}`).set('Authorization', `Bearer ${adminAccessB}`);
    expect(get.status).toBe(404);
    const list = await request(app).get('/api/v1/maintenance/orders').set('Authorization', `Bearer ${adminAccessB}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(0);
  });

  it('enforces permissions: viewer reads but cannot write', async () => {
    const read = await request(app).get('/api/v1/maintenance/assets').set('Authorization', `Bearer ${viewerAccessA}`);
    expect(read.status).toBe(200);
    const write = await request(app)
      .post('/api/v1/maintenance/assets')
      .set('Authorization', `Bearer ${viewerAccessA}`)
      .send({ code: 'X-1', name: 'X', type: 'T' });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks asset retire while open orders exist, then retires', async () => {
    const asset = await request(app)
      .post('/api/v1/maintenance/assets')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'TOR-02', name: 'Torno 2', type: 'Torno' });
    const aid = asset.body.data._id as string;
    const order = await request(app)
      .post('/api/v1/maintenance/orders')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ assetId: aid, type: 'PREVENTIVE', priority: 'LOW', title: 'Check' });
    const oid = order.body.data._id as string;
    const blocked = await request(app).delete(`/api/v1/maintenance/assets/${aid}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(blocked.status).toBe(409);
    const oversion = order.body.data.version as number;
    await request(app)
      .post(`/api/v1/maintenance/orders/${oid}/transition`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'CANCELLED', expectedVersion: oversion });
    const retired = await request(app).delete(`/api/v1/maintenance/assets/${aid}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(retired.status).toBe(200);
    expect(retired.body.data.status).toBe('RETIRED');
  });

  it('records audit events for mutations', async () => {
    const created = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'maintenance.order.created' }).exec();
    expect(created).toBeGreaterThan(0);
    const completed = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'maintenance.order.completed' }).exec();
    expect(completed).toBeGreaterThan(0);
    const assetCreated = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'maintenance.asset.created' }).exec();
    expect(assetCreated).toBeGreaterThan(0);
  });
});

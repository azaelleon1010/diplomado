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
import { AccountModel, FinanceCategoryModel, FinanceMovementModel } from '../../apps/api/src/modules/finance/infrastructure/models';
import type { Express } from 'express';

let mongod: MongoMemoryServer;
let app: Express;

const TENANT_A = 'TENANT_A';
const TENANT_B = 'TENANT_B';

let adminAccessA = '';
let viewerAccessA = '';
let adminAccessB = '';
let accountIdA = '';
let categoryIdA = '';
let movementIdA = '';
let movementVersionA = 0;

describe('Finance integration: accounts + categories + movements + isolation + permissions + audit', () => {
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
    process.env.MONGODB_DATABASE = 'test_finance';
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
      AccountModel,
      FinanceCategoryModel,
      FinanceMovementModel,
    ];
    for (const model of cleanModels) {
      await model.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    }
    const deps = buildIdentityDeps(testEmailProvider);
    // Login requires an ACTIVE tenant document (see c9e2b40).
    await TenantModel.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    await deps.tenants.create({ tenantId: TENANT_A, name: 'Tenant A', slug: 'tenant-a-finance-test', createdBy: 'test' });
    await deps.tenants.create({ tenantId: TENANT_B, name: 'Tenant B', slug: 'tenant-b-finance-test', createdBy: 'test' });
    app = createApp(deps);

    const perms = ['finance.read', 'finance.create', 'finance.update', 'finance.delete'];
    const adminRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'admin', permissions: perms, createdBy: 'test' });
    const adminHash = await deps.hasher.hash('AdminPass1');
    const adminA = await deps.users.create({ tenantId: TENANT_A, username: 'admina', email: 'admin@a.mx', passwordHash: adminHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: adminA._id, roleIds: [adminRoleA._id], createdBy: 'test' });
    const viewerRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'viewer', permissions: ['finance.read'], createdBy: 'test' });
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
  }, 90000);

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('requires authentication on finance routes', async () => {
    const res = await request(app).get('/api/v1/finance/accounts');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates account, category and income movement (201)', async () => {
    const account = await request(app)
      .post('/api/v1/finance/accounts')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: '1000', name: 'Caja', type: 'ASSET' });
    expect(account.status).toBe(201);
    accountIdA = account.body.data._id as string;

    const category = await request(app)
      .post('/api/v1/finance/categories')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ name: 'Ventas', kind: 'INCOME' });
    expect(category.status).toBe(201);
    categoryIdA = category.body.data._id as string;

    const movement = await request(app)
      .post('/api/v1/finance/movements')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ accountId: accountIdA, categoryId: categoryIdA, kind: 'INCOME', amount: 1500, method: 'TRANSFER', concept: 'Cobro factura F-1', date: '2026-10-05' });
    expect(movement.status).toBe(201);
    expect(movement.body.data.status).toBe('POSTED');
    expect(JSON.stringify(movement.body)).not.toContain('passwordHash');
    movementIdA = movement.body.data._id as string;
    movementVersionA = movement.body.data.version as number;

    const totals = await request(app).get('/api/v1/finance/movements/totals').set('Authorization', `Bearer ${adminAccessA}`);
    expect(totals.status).toBe(200);
    expect(totals.body.data).toMatchObject({ income: 1500, expenses: 0, balance: 1500 });
  });

  it('rejects duplicates, unknown references and bad amounts', async () => {
    const dup = await request(app)
      .post('/api/v1/finance/accounts')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: '1000', name: 'Otra', type: 'ASSET' });
    expect(dup.status).toBe(409);

    const badAccount = await request(app)
      .post('/api/v1/finance/movements')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ accountId: '000000000000000000000000', kind: 'INCOME', amount: 10, method: 'CASH', concept: 'Cobro', date: '2026-10-05' });
    expect(badAccount.status).toBe(404);

    const zero = await request(app)
      .post('/api/v1/finance/movements')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ accountId: accountIdA, kind: 'EXPENSE', amount: 0, method: 'CASH', concept: 'Ajuste', date: '2026-10-05' });
    expect(zero.status).toBe(400);

    const kindMismatch = await request(app)
      .post('/api/v1/finance/movements')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ accountId: accountIdA, categoryId: categoryIdA, kind: 'EXPENSE', amount: 10, method: 'CASH', concept: 'Gasto', date: '2026-10-05' });
    expect(kindMismatch.status).toBe(400);
  });

  it('isolates tenants end to end', async () => {
    const get = await request(app).get(`/api/v1/finance/movements/${movementIdA}`).set('Authorization', `Bearer ${adminAccessB}`);
    expect(get.status).toBe(404);
    const list = await request(app).get('/api/v1/finance/accounts').set('Authorization', `Bearer ${adminAccessB}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(0);
    const totals = await request(app).get('/api/v1/finance/movements/totals').set('Authorization', `Bearer ${adminAccessB}`);
    expect(totals.body.data).toMatchObject({ income: 0, expenses: 0, balance: 0 });
  });

  it('enforces permissions: viewer reads but cannot write', async () => {
    const read = await request(app).get('/api/v1/finance/movements').set('Authorization', `Bearer ${viewerAccessA}`);
    expect(read.status).toBe(200);
    const write = await request(app)
      .post('/api/v1/finance/movements')
      .set('Authorization', `Bearer ${viewerAccessA}`)
      .send({ accountId: accountIdA, kind: 'INCOME', amount: 10, method: 'CASH', concept: 'X', date: '2026-10-05' });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
  });

  it('voids movements and excludes them from totals', async () => {
    const expense = await request(app)
      .post('/api/v1/finance/movements')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ accountId: accountIdA, kind: 'EXPENSE', amount: 200, method: 'CASH', concept: 'Renta', date: '2026-10-05' });
    expect(expense.status).toBe(201);
    const before = await request(app).get('/api/v1/finance/movements/totals').set('Authorization', `Bearer ${adminAccessA}`);
    expect(before.body.data).toMatchObject({ income: 1500, expenses: 200, balance: 1300 });

    const voided = await request(app)
      .post(`/api/v1/finance/movements/${expense.body.data._id}/void`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ expectedVersion: expense.body.data.version });
    expect(voided.status).toBe(200);
    expect(voided.body.data.status).toBe('VOIDED');

    const after = await request(app).get('/api/v1/finance/movements/totals').set('Authorization', `Bearer ${adminAccessA}`);
    expect(after.body.data).toMatchObject({ income: 1500, expenses: 0, balance: 1500 });

    const again = await request(app)
      .post(`/api/v1/finance/movements/${expense.body.data._id}/void`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ expectedVersion: voided.body.data.version });
    expect(again.status).toBe(400);
  });

  it('records audit events for mutations', async () => {
    const created = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'finance.movement.created' }).exec();
    expect(created).toBeGreaterThan(0);
    const voided = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'finance.movement.voided' }).exec();
    expect(voided).toBeGreaterThan(0);
  });
});

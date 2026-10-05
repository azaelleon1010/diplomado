import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { createApp } from '../../apps/api/src/app';
import { applicationModels } from '../../apps/api/src/infrastructure/models';
import { buildIdentityDeps } from '../../apps/api/src/modules/identity/presentation/routes';
import type { IEmailProvider } from '../../apps/api/src/modules/notifications/domain/ports';
import { AuditEventModel, MembershipModel, RoleModel, UserModel } from '../../apps/api/src/modules/identity/infrastructure/models';
import { DepartmentModel, EmployeeModel, TimeOffModel } from '../../apps/api/src/modules/hr/infrastructure/models';
import type { Express } from 'express';

let mongod: MongoMemoryServer;
let app: Express;

const TENANT_A = 'TENANT_A';
const TENANT_B = 'TENANT_B';

let adminAccessA = '';
let viewerAccessA = '';
let adminAccessB = '';
let departmentIdA = '';
let employeeIdA = '';
let employeeVersionA = 0;
let timeOffIdA = '';
let timeOffVersionA = 0;

describe('HR integration: departments + employees + time off + isolation + permissions + audit', () => {
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
    process.env.MONGODB_DATABASE = 'test_hr';
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
      DepartmentModel,
      EmployeeModel,
      TimeOffModel,
    ];
    for (const model of cleanModels) {
      await model.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();
    }
    const deps = buildIdentityDeps(testEmailProvider);
    app = createApp(deps);

    const perms = ['hr.read.self', 'hr.read.team', 'hr.write'];
    const adminRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'admin', permissions: perms, createdBy: 'test' });
    const adminHash = await deps.hasher.hash('AdminPass1');
    const adminA = await deps.users.create({ tenantId: TENANT_A, username: 'admina', email: 'admin@a.mx', passwordHash: adminHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: adminA._id, roleIds: [adminRoleA._id], createdBy: 'test' });
    const viewerRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'viewer', permissions: ['hr.read.self'], createdBy: 'test' });
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

  it('requires authentication on hr routes', async () => {
    const res = await request(app).get('/api/v1/hr/employees');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('creates department, employee and time-off request (201)', async () => {
    const department = await request(app)
      .post('/api/v1/hr/departments')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ name: 'Producción' });
    expect(department.status).toBe(201);
    departmentIdA = department.body.data._id as string;

    const employee = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'emp-001', firstName: 'Juan', lastName: 'Pérez', email: 'juan@empresa.mx', departmentId: departmentIdA, position: 'Operador' });
    expect(employee.status).toBe(201);
    expect(employee.body.data.code).toBe('EMP-001');
    expect(JSON.stringify(employee.body)).not.toContain('passwordHash');
    employeeIdA = employee.body.data._id as string;
    employeeVersionA = employee.body.data.version as number;

    const timeOff = await request(app)
      .post('/api/v1/hr/time-off')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ employeeId: employeeIdA, type: 'VACATION', startDate: '2026-12-20', endDate: '2026-12-27', reason: 'Vacaciones' });
    expect(timeOff.status).toBe(201);
    expect(timeOff.body.data.status).toBe('PENDING');
    timeOffIdA = timeOff.body.data._id as string;
    timeOffVersionA = timeOff.body.data.version as number;
  });

  it('rejects duplicates, unknown references and bad ranges', async () => {
    const dupDept = await request(app)
      .post('/api/v1/hr/departments')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ name: 'Producción' });
    expect(dupDept.status).toBe(409);

    const dupCode = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'EMP-001', firstName: 'X', lastName: 'Y' });
    expect(dupCode.status).toBe(409);

    const badDept = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'EMP-002', firstName: 'X', lastName: 'Y', departmentId: '000000000000000000000000' });
    expect(badDept.status).toBe(404);

    const badRange = await request(app)
      .post('/api/v1/hr/time-off')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ employeeId: employeeIdA, type: 'SICK', startDate: '2026-10-05', endDate: '2026-10-01' });
    expect(badRange.status).toBe(400);
  });

  it('isolates tenants end to end', async () => {
    const get = await request(app).get(`/api/v1/hr/employees/${employeeIdA}`).set('Authorization', `Bearer ${adminAccessB}`);
    expect(get.status).toBe(404);
    const list = await request(app).get('/api/v1/hr/employees').set('Authorization', `Bearer ${adminAccessB}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(0);
    const other = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${adminAccessB}`)
      .send({ code: 'emp-001', firstName: 'Ana', lastName: 'López' });
    expect(other.status).toBe(201);
  });

  it('enforces permissions: self-service reads, writes need hr.write', async () => {
    const mine = await request(app).get('/api/v1/hr/time-off').set('Authorization', `Bearer ${viewerAccessA}`);
    expect(mine.status).toBe(200);
    const write = await request(app)
      .post('/api/v1/hr/departments')
      .set('Authorization', `Bearer ${viewerAccessA}`)
      .send({ name: 'X' });
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe('FORBIDDEN');
    const decide = await request(app)
      .post(`/api/v1/hr/time-off/${timeOffIdA}/decision`)
      .set('Authorization', `Bearer ${viewerAccessA}`)
      .send({ to: 'APPROVED', expectedVersion: timeOffVersionA });
    expect(decide.status).toBe(403);
  });

  it('approves time-off and guards terminal states', async () => {
    const approved = await request(app)
      .post(`/api/v1/hr/time-off/${timeOffIdA}/decision`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'APPROVED', expectedVersion: timeOffVersionA });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.decidedBy).toBeTruthy();
    const again = await request(app)
      .post(`/api/v1/hr/time-off/${timeOffIdA}/decision`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ to: 'REJECTED', expectedVersion: approved.body.data.version });
    expect(again.status).toBe(400);
  });

  it('updates employees and blocks department deactivation with staff', async () => {
    const updated = await request(app)
      .patch(`/api/v1/hr/employees/${employeeIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ position: 'Supervisor', expectedVersion: employeeVersionA });
    expect(updated.status).toBe(200);
    expect(updated.body.data.position).toBe('Supervisor');

    const blocked = await request(app).delete(`/api/v1/hr/departments/${departmentIdA}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(blocked.status).toBe(409);
  });

  it('records audit events for mutations', async () => {
    const created = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'hr.employee.created' }).exec();
    expect(created).toBeGreaterThan(0);
    const approved = await AuditEventModel.countDocuments({ tenantId: TENANT_A, action: 'hr.timeoff.approved' }).exec();
    expect(approved).toBeGreaterThan(0);
  });
});

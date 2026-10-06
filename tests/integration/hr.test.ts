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
import { TenantModel } from '../../apps/api/src/modules/tenant/infrastructure/models';
import { DepartmentModel, EmployeeModel, TimeOffModel } from '../../apps/api/src/modules/hr/infrastructure/models';
import type { Express } from 'express';

let mongod: MongoMemoryServer;
let app: Express;

const TENANT_A = 'TENANT_A';
const TENANT_B = 'TENANT_B';

let adminAccessA = '';
let viewerAccessA = '';
let selfWriterAccessA = '';
let unlinkedSelfAccessA = '';
let adminAccessB = '';
let departmentIdA = '';
let employeeIdA = '';
let otherEmployeeIdA = '';
let selfEmployeeIdA = '';
let viewerUserIdA = '';
let selfUserIdA = '';
let adminUserIdA = '';
let inactiveUserIdA = '';
let adminUserIdB = '';
let employeeVersionA = 0;
let otherEmployeeVersionA = 0;
let timeOffIdA = '';
let otherTimeOffIdA = '';
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
      TenantModel,
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
    await deps.tenants.create({ tenantId: TENANT_A, name: 'Tenant A', slug: 'tenant-a-hr-test', createdBy: 'test' });
    await deps.tenants.create({ tenantId: TENANT_B, name: 'Tenant B', slug: 'tenant-b-hr-test', createdBy: 'test' });
    app = createApp(deps);

    const perms = ['hr.read.self', 'hr.read.team', 'hr.write'];
    const adminRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'admin', permissions: perms, createdBy: 'test' });
    const adminHash = await deps.hasher.hash('AdminPass1');
    const adminA = await deps.users.create({ tenantId: TENANT_A, username: 'admina', email: 'admin@a.mx', passwordHash: adminHash, createdBy: 'test' });
    adminUserIdA = adminA._id;
    await deps.memberships.create({ tenantId: TENANT_A, userId: adminA._id, roleIds: [adminRoleA._id], createdBy: 'test' });
    const viewerRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'viewer', permissions: ['hr.read.self'], createdBy: 'test' });
    const viewerHash = await deps.hasher.hash('ViewerPass1');
    const viewerA = await deps.users.create({ tenantId: TENANT_A, username: 'viewera', email: 'viewer@a.mx', passwordHash: viewerHash, createdBy: 'test' });
    viewerUserIdA = viewerA._id;
    await deps.memberships.create({ tenantId: TENANT_A, userId: viewerA._id, roleIds: [viewerRoleA._id], createdBy: 'test' });
    const selfRoleA = await deps.roles.create({ tenantId: TENANT_A, name: 'self-service', permissions: ['hr.read.self', 'hr.write.self'], createdBy: 'test' });
    const selfHash = await deps.hasher.hash('SelfPass1');
    const selfUserA = await deps.users.create({ tenantId: TENANT_A, username: 'selfusera', email: 'self@a.mx', passwordHash: selfHash, createdBy: 'test' });
    selfUserIdA = selfUserA._id;
    await deps.memberships.create({ tenantId: TENANT_A, userId: selfUserA._id, roleIds: [selfRoleA._id], createdBy: 'test' });
    const unlinkedSelfUserA = await deps.users.create({ tenantId: TENANT_A, username: 'unlinkedselfa', email: 'juan@empresa.mx', passwordHash: selfHash, createdBy: 'test' });
    await deps.memberships.create({ tenantId: TENANT_A, userId: unlinkedSelfUserA._id, roleIds: [selfRoleA._id], createdBy: 'test' });
    const inactiveUserA = await deps.users.create({ tenantId: TENANT_A, username: 'inactivea', email: 'inactive@a.mx', passwordHash: selfHash, createdBy: 'test' });
    inactiveUserIdA = inactiveUserA._id;
    await UserModel.updateOne({ _id: inactiveUserIdA, tenantId: TENANT_A }, { $set: { status: 'INACTIVE' } }).exec();
    const adminRoleB = await deps.roles.create({ tenantId: TENANT_B, name: 'admin', permissions: perms, createdBy: 'test' });
    const adminHashB = await deps.hasher.hash('AdminPass2');
    const adminB = await deps.users.create({ tenantId: TENANT_B, username: 'adminb', email: 'admin@b.mx', passwordHash: adminHashB, createdBy: 'test' });
    adminUserIdB = adminB._id;
    await deps.memberships.create({ tenantId: TENANT_B, userId: adminB._id, roleIds: [adminRoleB._id], createdBy: 'test' });

    const loginA = await request(app).post('/api/v1/auth/login').send({ email: 'admin@a.mx', password: 'AdminPass1' });
    adminAccessA = loginA.body.data.accessToken as string;
    const loginViewer = await request(app).post('/api/v1/auth/login').send({ email: 'viewer@a.mx', password: 'ViewerPass1' });
    viewerAccessA = loginViewer.body.data.accessToken as string;
    const loginSelfWriter = await request(app).post('/api/v1/auth/login').send({ email: 'self@a.mx', password: 'SelfPass1' });
    selfWriterAccessA = loginSelfWriter.body.data.accessToken as string;
    const loginUnlinkedSelf = await request(app).post('/api/v1/auth/login').send({ email: 'juan@empresa.mx', password: 'SelfPass1' });
    unlinkedSelfAccessA = loginUnlinkedSelf.body.data.accessToken as string;
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
      .send({ code: 'emp-001', firstName: 'Juan', lastName: 'Pérez', userId: viewerUserIdA, email: 'juan@empresa.mx', departmentId: departmentIdA, position: 'Operador' });
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

    const otherEmployee = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'OTHER-001', firstName: 'Ana', lastName: 'López' });
    expect(otherEmployee.status).toBe(201);
    otherEmployeeIdA = otherEmployee.body.data._id as string;
    otherEmployeeVersionA = otherEmployee.body.data.version as number;
    const selfEmployee = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'SELF-001', firstName: 'Sofía', lastName: 'García', userId: selfUserIdA });
    expect(selfEmployee.status).toBe(201);
    selfEmployeeIdA = selfEmployee.body.data._id as string;

    const otherTimeOff = await request(app)
      .post('/api/v1/hr/time-off')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ employeeId: otherEmployeeIdA, type: 'SICK', startDate: '2026-11-12', endDate: '2026-11-13' });
    expect(otherTimeOff.status).toBe(201);
    otherTimeOffIdA = otherTimeOff.body.data._id as string;
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

  it('enforces unique employee links and audits link changes', async () => {
    const indexes = await EmployeeModel.collection.indexes();
    const userLinkIndex = indexes.find((index) => index.name === 'uniq_tenant_employee_user');
    expect(userLinkIndex?.unique).toBe(true);
    expect(userLinkIndex?.partialFilterExpression).toEqual({ userId: { $type: 'string' } });

    const duplicateCreate = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'DUP-LINK', firstName: 'Duplicado', lastName: 'Usuario', userId: viewerUserIdA });
    expect(duplicateCreate.status).toBe(409);
    expect(duplicateCreate.body.error.code).toBe('CONFLICT');

    const duplicateUpdate = await request(app)
      .patch(`/api/v1/hr/employees/${otherEmployeeIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ userId: viewerUserIdA, expectedVersion: otherEmployeeVersionA });
    expect(duplicateUpdate.status).toBe(409);
    expect(duplicateUpdate.body.error.code).toBe('CONFLICT');

    const crossTenantUpdate = await request(app)
      .patch(`/api/v1/hr/employees/${otherEmployeeIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ userId: adminUserIdB, expectedVersion: otherEmployeeVersionA });
    expect(crossTenantUpdate.status).toBe(404);

    const inactiveUserUpdate = await request(app)
      .patch(`/api/v1/hr/employees/${otherEmployeeIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ userId: inactiveUserIdA, expectedVersion: otherEmployeeVersionA });
    expect(inactiveUserUpdate.status).toBe(404);

    const linked = await request(app)
      .patch(`/api/v1/hr/employees/${otherEmployeeIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ userId: adminUserIdA, expectedVersion: otherEmployeeVersionA });
    expect(linked.status).toBe(200);
    expect(linked.body.data.userId).toBe(adminUserIdA);

    const unlinked = await request(app)
      .patch(`/api/v1/hr/employees/${otherEmployeeIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ userId: null, expectedVersion: linked.body.data.version });
    expect(unlinked.status).toBe(200);
    expect(unlinked.body.data.userId).toBeUndefined();

    const linkAudit = await AuditEventModel.find({
      tenantId: TENANT_A,
      entityType: 'employee',
      entityId: otherEmployeeIdA,
      action: 'hr.employee.updated',
    }).lean().exec();
    expect(linkAudit).toHaveLength(2);
    expect(linkAudit.some((event) => event.before?.userId == null && event.after?.userId === adminUserIdA)).toBe(true);
    expect(linkAudit.some((event) => event.before?.userId === adminUserIdA && event.after?.userId == null)).toBe(true);
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

    const crossTenantLink = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ code: 'CROSS-LINK', firstName: 'Cross', lastName: 'Tenant', userId: adminUserIdB });
    expect(crossTenantLink.status).toBe(404);
  });

  it('enforces self-only time-off reads and keeps read-only users from writing', async () => {
    const mine = await request(app)
      .get('/api/v1/hr/time-off')
      .query({ employeeId: otherEmployeeIdA })
      .set('Authorization', `Bearer ${viewerAccessA}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].employeeId).toBe(employeeIdA);

    const other = await request(app)
      .get(`/api/v1/hr/time-off/${otherTimeOffIdA}`)
      .set('Authorization', `Bearer ${viewerAccessA}`);
    expect(other.status).toBe(404);

    const selfWrite = await request(app)
      .post('/api/v1/hr/time-off')
      .set('Authorization', `Bearer ${viewerAccessA}`)
      .send({ employeeId: otherEmployeeIdA, type: 'VACATION', startDate: '2026-12-01', endDate: '2026-12-02' });
    expect(selfWrite.status).toBe(403);

    const selfCancel = await request(app)
      .post(`/api/v1/hr/time-off/${timeOffIdA}/cancel`)
      .set('Authorization', `Bearer ${viewerAccessA}`)
      .send({ expectedVersion: timeOffVersionA });
    expect(selfCancel.status).toBe(403);

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

  it('self write permission ignores client employeeId and only cancels own pending requests', async () => {
    const created = await request(app)
      .post('/api/v1/hr/time-off')
      .set('Authorization', `Bearer ${selfWriterAccessA}`)
      .send({ employeeId: otherEmployeeIdA, type: 'VACATION', startDate: '2026-12-03', endDate: '2026-12-04' });
    expect(created.status).toBe(201);
    expect(created.body.data.employeeId).toBe(selfEmployeeIdA);

    const foreignCancel = await request(app)
      .post(`/api/v1/hr/time-off/${otherTimeOffIdA}/cancel`)
      .set('Authorization', `Bearer ${selfWriterAccessA}`)
      .send({ expectedVersion: 1 });
    expect(foreignCancel.status).toBe(404);

    const adminCanRead = await request(app)
      .get(`/api/v1/hr/time-off/${otherTimeOffIdA}`)
      .set('Authorization', `Bearer ${adminAccessA}`);
    expect(adminCanRead.status).toBe(200);
    expect(adminCanRead.body.data.employeeId).toBe(otherEmployeeIdA);

    const ownCancel = await request(app)
      .post(`/api/v1/hr/time-off/${created.body.data._id}/cancel`)
      .set('Authorization', `Bearer ${selfWriterAccessA}`)
      .send({ expectedVersion: created.body.data.version });
    expect(ownCancel.status).toBe(200);
    expect(ownCancel.body.data.status).toBe('CANCELLED');
  });

  it('fails closed for self-service accounts without an employee link, even when email matches', async () => {
    const list = await request(app)
      .get('/api/v1/hr/time-off')
      .set('Authorization', `Bearer ${unlinkedSelfAccessA}`);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post('/api/v1/hr/time-off')
      .set('Authorization', `Bearer ${unlinkedSelfAccessA}`)
      .send({ employeeId: employeeIdA, type: 'SICK', startDate: '2026-12-08', endDate: '2026-12-09' });
    expect(create.status).toBe(403);
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

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { applicationModels } from '../../apps/api/src/infrastructure/models';
import { syncFullAccessRolePermissions } from '../../apps/api/src/modules/identity/application/roleSync';
import { MongoAuditSink, MongoRoleStore } from '../../apps/api/src/modules/identity/infrastructure/repositories';
import { AuditEventModel } from '../../apps/api/src/modules/identity/infrastructure/models';
import { ALL_PERMISSIONS } from '../../apps/api/src/modules/identity/domain/permissions';

let mongod: MongoMemoryReplSet | undefined;
const stamp = Date.now().toString(36);
const T1 = `TENANT_SYNC_1_${stamp}`;
const T2 = `TENANT_SYNC_2_${stamp}`;

describe('role permission sync (owner/admin catch up with the catalog)', () => {
  const roles = new MongoRoleStore();
  const deps = { roles, audit: new MongoAuditSink() };
  let ownerId = '';
  let adminId = '';
  let viewerId = '';
  let wildcardId = '';

  beforeAll(async () => {
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      process.env.MONGODB_URI = mongod.getUri();
    }
    process.env.MONGODB_DATABASE = 'test_role_sync';
    process.env.NODE_ENV = 'test';
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    __resetConfigForTests();
    await disconnectMongo().catch(() => {});
    await connectMongo();
    await ensureIndexes(applicationModels);

    // An owner registered before the catalog grew, plus a custom extra grant.
    ownerId = (await roles.create({ tenantId: T1, name: 'owner', permissions: ['inventory.read', 'custom.extra'], createdBy: 'test' }))._id;
    adminId = (await roles.create({ tenantId: T2, name: 'admin', permissions: [...ALL_PERMISSIONS], createdBy: 'test' }))._id;
    viewerId = (await roles.create({ tenantId: T1, name: 'viewer', permissions: ['inventory.read'], createdBy: 'test' }))._id;
    wildcardId = (await roles.create({ tenantId: `${T2}_W`, name: 'admin', permissions: ['*'], createdBy: 'test' }))._id;
  }, 90000);

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('dry run reports outdated roles without writing', async () => {
    const report = await syncFullAccessRolePermissions(deps, { apply: false });
    const owner = report.entries.find((e) => e.roleId === ownerId);
    expect(owner?.missing).toEqual(ALL_PERMISSIONS.filter((p) => p !== 'inventory.read'));
    expect(owner?.applied).toBe(false);
    expect(report.entries.map((e) => e.roleId)).not.toContain(adminId);
    expect(report.entries.map((e) => e.roleId)).not.toContain(wildcardId);
    expect(report.updated).toBe(0);
    expect((await roles.findById(T1, ownerId))?.permissions).toEqual(['inventory.read', 'custom.extra']);
  });

  it('apply adds only missing permissions, keeps custom grants and audits', async () => {
    const report = await syncFullAccessRolePermissions(deps, { apply: true });
    expect(report.entries.find((e) => e.roleId === ownerId)?.applied).toBe(true);

    const owner = await roles.findById(T1, ownerId);
    for (const p of ALL_PERMISSIONS) expect(owner?.permissions).toContain(p);
    expect(owner?.permissions).toContain('custom.extra');
    expect(new Set(owner?.permissions).size).toBe(owner?.permissions.length);

    expect((await roles.findById(T1, viewerId))?.permissions).toEqual(['inventory.read']);
    expect((await roles.findById(`${T2}_W`, wildcardId))?.permissions).toEqual(['*']);

    const audit = await AuditEventModel.findOne({ tenantId: T1, action: 'roles.permissionsSynced', entityId: ownerId }).lean().exec();
    expect(audit).not.toBeNull();
  });

  it('is idempotent', async () => {
    const report = await syncFullAccessRolePermissions(deps, { apply: true });
    expect(report.entries.map((e) => e.roleId)).not.toContain(ownerId);
  });
});

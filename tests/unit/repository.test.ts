import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose, { Schema, model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { BaseRepository, TenantContext } from '../../packages/database/src/repository';
import { baseFields, baseOptions } from '../../packages/database/src/base';

interface TestDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  code: string;
  name: string;
  status: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

let mongod: MongoMemoryServer;

const testSchema = new Schema<TestDoc>(
  {
    tenantId: (baseFields.tenantId as any),
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true },
    status: { type: String, default: 'ACTIVE' },
    createdBy: (baseFields.createdBy as any),
    updatedBy: (baseFields.updatedBy as any),
    version: (baseFields.version as any),
  },
  { ...baseOptions, collection: 'test_customers' }
);
// unique per tenant (critical business rule)
testSchema.index({ tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_code' });
testSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

const TestModel = model<TestDoc>('TestCustomer', testSchema);

class TestRepo extends BaseRepository<TestDoc> {
  constructor() { super(TestModel as any); }
}

const ctxA: TenantContext = { tenantId: 'tenant-A', userId: 'user-1' };
const ctxB: TenantContext = { tenantId: 'tenant-B', userId: 'user-2' };

describe('BaseRepository — tenant isolation & ops', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGODB_DATABASE = 'test_repo';
    process.env.NODE_ENV = 'test';
    __resetConfigForTests();
    await connectMongo();
  });
  afterAll(async () => {
    await TestModel.deleteMany({});
    await disconnectMongo();
    await mongod.stop();
    __resetConfigForTests();
  });
  beforeEach(async () => { await TestModel.deleteMany({}); });

  it('creates and finds with tenant isolation', async () => {
    const repo = new TestRepo();
    const docA = await repo.create({ code: 'C001', name: 'Alice' } as any, ctxA);
    expect(docA.tenantId).toBe('tenant-A');
    // mongoose versionKey starts at 0 (optimisticConcurrency)
    expect([0, 1]).toContain(docA.version);

    const foundA = await repo.findById(String(docA._id), ctxA);
    expect(foundA).not.toBeNull();
    expect(foundA!.name).toBe('Alice');

    const foundB = await repo.findById(String(docA._id), ctxB);
    expect(foundB).toBeNull(); // Tenant B must not see A's doc
  });

  it('findMany respects tenant filter', async () => {
    const repo = new TestRepo();
    await repo.create({ code: 'C001', name: 'A1' } as any, ctxA);
    await repo.create({ code: 'C002', name: 'A2' } as any, ctxA);
    await repo.create({ code: 'C001', name: 'B1' } as any, ctxB); // same code, different tenant (allowed)

    const resA = await repo.findMany({}, ctxA, { page: 1, limit: 10 });
    expect(resA.total).toBe(2);
    expect(resA.data.every((d) => d.tenantId === 'tenant-A')).toBe(true);

    const resB = await repo.findMany({}, ctxB, { page: 1, limit: 10 });
    expect(resB.total).toBe(1);
    expect(resB.data[0].tenantId).toBe('tenant-B');
  });

  it('duplicate key (tenant+code) maps to 409 CONFLICT not raw E11000', async () => {
    const repo = new TestRepo();
    await repo.create({ code: 'DUP', name: 'first' } as any, ctxA);
    await expect(repo.create({ code: 'DUP', name: 'second' } as any, ctxA)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
  });

  it('same code across tenants is allowed (compound unique)', async () => {
    const repo = new TestRepo();
    await repo.create({ code: 'SHARED', name: 'A' } as any, ctxA);
    const b = await repo.create({ code: 'SHARED', name: 'B' } as any, ctxB);
    expect(b.code).toBe('SHARED');
  });

  it('optimistic concurrency: stale version throws VERSION_CONFLICT', async () => {
    const repo = new TestRepo();
    const doc = await repo.create({ code: 'VER', name: 'v1' } as any, ctxA);
    const initialVersion = doc.version;

    const updated = await repo.updateById(String(doc._id), { name: 'v2' } as any, ctxA, initialVersion);
    expect(updated.version).toBe(initialVersion + 1);
    expect(updated.name).toBe('v2');

    await expect(repo.updateById(String(doc._id), { name: 'stale' } as any, ctxA, initialVersion)).rejects.toMatchObject({
      code: 'VERSION_CONFLICT',
      statusCode: 409,
    });
  });

  it('tenant isolation on update: cannot update other tenant doc', async () => {
    const repo = new TestRepo();
    const docA = await repo.create({ code: 'UPD', name: 'orig' } as any, ctxA);
    await expect(repo.updateById(String(docA._id), { name: 'hacked' } as any, ctxB, 1)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('cross-tenant enumeration returns no data (not 200 with leakage)', async () => {
    const repo = new TestRepo();
    await repo.create({ code: 'ENUM', name: 'secret' } as any, ctxA);
    const res = await repo.findMany({ code: 'ENUM' } as any, ctxB, { page: 1, limit: 10 });
    expect(res.total).toBe(0);
    expect(res.data).toHaveLength(0);
  });
});

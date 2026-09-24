import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose, { Schema, model } from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { withTransaction } from '../../packages/database/src/transaction';
import { baseFields, baseOptions } from '../../packages/database/src/base';

let replSet: MongoMemoryReplSet;

interface Doc extends mongoose.Document { tenantId: string; amount: number; version: number; createdBy: string; updatedBy: string; _id: mongoose.Types.ObjectId; }

describe('transactions — Atlas-ready infrastructure', () => {
  beforeAll(async () => {
    await disconnectMongo().catch(() => {});
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = replSet.getUri();
    process.env.MONGODB_DATABASE = 'test_tx';
    process.env.NODE_ENV = 'test';
    __resetConfigForTests();
    await connectMongo();
  });
  afterAll(async () => {
    await disconnectMongo();
    await replSet.stop();
    __resetConfigForTests();
  });

  it('withTransaction commits atomically', async () => {
    const schema = new Schema<Doc>({ tenantId: baseFields.tenantId as any, amount: Number, createdBy: baseFields.createdBy as any, updatedBy: baseFields.updatedBy as any, version: baseFields.version as any }, { ...baseOptions, collection: 'tx_test' });
    const M = model<Doc>('TxTest', schema);

    await withTransaction(async (session) => {
      await M.create([{ tenantId: 't1', amount: 100, createdBy: 'u1', updatedBy: 'u1' }], { session });
      await M.create([{ tenantId: 't1', amount: 200, createdBy: 'u1', updatedBy: 'u1' }], { session });
    });

    const count = await M.countDocuments({ tenantId: 't1' });
    expect(count).toBe(2);
    await M.deleteMany({});
    mongoose.deleteModel('TxTest');
  });

  it('withTransaction rolls back on error', async () => {
    const schema = new Schema<Doc>({ tenantId: baseFields.tenantId as any, amount: Number, createdBy: baseFields.createdBy as any, updatedBy: baseFields.updatedBy as any, version: baseFields.version as any }, { ...baseOptions, collection: 'tx_rollback' });
    const M = model<Doc>('TxRollback', schema);

    await expect(withTransaction(async (session) => {
      await M.create([{ tenantId: 't1', amount: 1, createdBy: 'u1', updatedBy: 'u1' }], { session });
      throw new Error('business rule violation');
    })).rejects.toThrow('business rule violation');

    const count = await M.countDocuments({ tenantId: 't1' });
    expect(count).toBe(0);
    await M.deleteMany({});
    mongoose.deleteModel('TxRollback');
  });
});

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
// mongoose import not needed directly — connection via @erp/database
import { MongoMemoryServer } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo, isConnected, getConnectionState } from '../../packages/database/src/connection';
import { pingMongo } from '../../packages/database/src/health';

let mongod: MongoMemoryServer;

describe('MongoDB connection lifecycle', () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
    process.env.MONGODB_DATABASE = 'test_erp';
    process.env.NODE_ENV = 'test';
    __resetConfigForTests();
    // ensure clean state
    await disconnectMongo().catch(() => {});
  });

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('connects successfully and ping returns ok', async () => {
    await connectMongo();
    expect(isConnected()).toBe(true);
    const state = getConnectionState();
    expect(state.label).toBe('connected');
    const ping = await pingMongo();
    expect(ping.status).toBe('ok');
    expect(ping.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('connect is idempotent (second call reuses pool)', async () => {
    const c1 = await connectMongo();
    const c2 = await connectMongo();
    expect(c1).toBe(c2);
    expect(isConnected()).toBe(true);
  });

  it('reports down after disconnect', async () => {
    await disconnectMongo();
    expect(isConnected()).toBe(false);
    const ping = await pingMongo();
    expect(ping.status).toBe('down');
    // reconnect for other tests
    await connectMongo();
    expect(isConnected()).toBe(true);
  });

  it('fails fast on invalid URI (config validation)', async () => {
    const prevUri = process.env.MONGODB_URI;
    process.env.MONGODB_URI = '';
    __resetConfigForTests();
    // getMongoConfig -> getConfig should throw due to min(1) validation
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getMongoConfig } = require('../../packages/config/src/index');
      getMongoConfig();
    }).toThrow();
    // restore
    process.env.MONGODB_URI = mongod.getUri();
    __resetConfigForTests();
    // ensure still connected (no need to reconnect, already connected)
    expect(isConnected()).toBe(true);
    expect(prevUri).toContain('127.0.0.1');
  });
});

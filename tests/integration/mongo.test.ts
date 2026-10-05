import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import {
  connectMongo,
  disconnectMongo,
  isConnected,
  getConnectionState,
} from '../../packages/database/src/connection';
import { pingMongo } from '../../packages/database/src/health';

let mongod: MongoMemoryServer | undefined;
let mongoUri: string;

describe('MongoDB connection lifecycle', () => {
  beforeAll(async () => {
    const testMongoUri = process.env.TEST_MONGO_URI;

    if (testMongoUri) {
      mongoUri = testMongoUri;
    } else {
      mongod = await MongoMemoryServer.create();
      mongoUri = mongod.getUri();
    }

    process.env.MONGODB_URI = mongoUri;
    process.env.MONGODB_DATABASE = 'test_erp';
    process.env.NODE_ENV = 'test';

    __resetConfigForTests();

    await disconnectMongo().catch(() => {});
  });

  afterAll(async () => {
    await disconnectMongo().catch(() => {});

    if (mongod) {
      await mongod.stop();
    }

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

    await connectMongo();

    expect(isConnected()).toBe(true);
  });

  it('fails fast on invalid URI (config validation)', async () => {
    const prevUri = process.env.MONGODB_URI;

    process.env.MONGODB_URI = '';
    __resetConfigForTests();

    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getMongoConfig } = require('../../packages/config/src/index');
      getMongoConfig();
    }).toThrow();

    process.env.MONGODB_URI = prevUri;
    __resetConfigForTests();

    expect(isConnected()).toBe(true);
  });
});
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { __resetConfigForTests, getConfig, getMongoConfig } from '../../packages/config/src/index';

describe('mongo config', () => {
  const originalEnv = { ...process.env };
  beforeEach(() => __resetConfigForTests());
  afterEach(() => {
    process.env = { ...originalEnv };
    __resetConfigForTests();
  });

  it('maps MONGODB_DATABASE precedence over MONGODB_DB_NAME', async () => {
    process.env.MONGODB_DATABASE = 'my_atlas_db';
    process.env.MONGODB_DB_NAME = 'legacy_name';
    __resetConfigForTests();
    const cfg = getConfig();
    expect(cfg.MONGODB_DATABASE).toBe('my_atlas_db');
    expect(cfg.MONGODB_DB_NAME).toBe('my_atlas_db');
    expect(getMongoConfig().dbName).toBe('my_atlas_db');
  });

  it('falls back to MONGODB_DB_NAME when MONGODB_DATABASE absent', async () => {
    delete process.env.MONGODB_DATABASE;
    process.env.MONGODB_DB_NAME = 'fallback_db';
    __resetConfigForTests();
    const cfg = getConfig();
    expect(cfg.MONGODB_DATABASE).toBe('fallback_db');
  });

  it('validates pool sizes and timeouts are numbers', () => {
    process.env.MONGODB_MAX_POOL_SIZE = '25';
    process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS = '3000';
    __resetConfigForTests();
    const m = getMongoConfig();
    expect(m.maxPoolSize).toBe(25);
    expect(m.serverSelectionTimeoutMS).toBe(3000);
  });

  it('throws on invalid pool size', () => {
    process.env.MONGODB_MAX_POOL_SIZE = '9999';
    __resetConfigForTests();
    expect(() => getConfig()).toThrow(/Invalid environment configuration/);
  });

  it('defaults are sane (Atlas-ready)', () => {
    delete process.env.MONGODB_MAX_POOL_SIZE;
    delete process.env.MONGODB_MIN_POOL_SIZE;
    __resetConfigForTests();
    const m = getMongoConfig();
    expect(m.maxPoolSize).toBeGreaterThan(0);
    expect(m.minPoolSize).toBeGreaterThanOrEqual(0);
    expect(m.serverSelectionTimeoutMS).toBeGreaterThan(0);
  });
});

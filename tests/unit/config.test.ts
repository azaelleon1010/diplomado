import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { __resetConfigForTests, getConfig } from '../../packages/config/src/index';

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    __resetConfigForTests();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    __resetConfigForTests();
  });

  it('loads default config without throwing', () => {
    const cfg = getConfig();
    expect(cfg.server.port).toBeGreaterThan(0);
    expect(cfg.API_VERSION).toBeDefined();
    expect(cfg.MONGODB_URI).toBeDefined();
  });

  it('defaults Redis to disabled when REDIS_ENABLED is absent', () => {
    delete process.env.REDIS_ENABLED;
    __resetConfigForTests();
    expect(getConfig().redis.enabled).toBe(false);
  });

  it('parses REDIS_ENABLED=false as a boolean', () => {
    process.env.REDIS_ENABLED = 'false';
    __resetConfigForTests();
    expect(getConfig().redis.enabled).toBe(false);
  });

  it('parses REDIS_ENABLED=true as a boolean', () => {
    process.env.REDIS_ENABLED = 'true';
    __resetConfigForTests();
    expect(getConfig().redis.enabled).toBe(true);
  });

  it.each(['invalid', 'yes', 'no', '1', '0', 'on', 'off'])('rejects ambiguous REDIS_ENABLED=%s', (value) => {
    process.env.REDIS_ENABLED = value;
    __resetConfigForTests();
    expect(() => getConfig()).toThrow(/REDIS_ENABLED/);
  });

  it('parses PORT as a number', () => {
    process.env.PORT = '3000';
    __resetConfigForTests();
    expect(getConfig().server.port).toBe(3000);
    expect(typeof getConfig().server.port).toBe('number');
  });

  it('parses all configured numeric environment values as numbers', () => {
    Object.assign(process.env, {
      PORT: '3001',
      MONGODB_MAX_POOL_SIZE: '12',
      MONGODB_MIN_POOL_SIZE: '1',
      MONGODB_SERVER_SELECTION_TIMEOUT_MS: '4000',
      MONGODB_SOCKET_TIMEOUT_MS: '5000',
      MONGODB_MAX_IDLE_TIME_MS: '6000',
      REDIS_MAX_RETRIES_PER_REQUEST: '2',
      BCRYPT_ROUNDS: '11',
      RATE_LIMIT_WINDOW_MS: '30000',
      RATE_LIMIT_MAX: '150',
      WORKER_CONCURRENCY: '4',
    });
    __resetConfigForTests();
    const config = getConfig();
    expect([
      config.server.port,
      config.MONGODB_MAX_POOL_SIZE,
      config.MONGODB_MIN_POOL_SIZE,
      config.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      config.MONGODB_SOCKET_TIMEOUT_MS,
      config.MONGODB_MAX_IDLE_TIME_MS,
      config.redis.maxRetriesPerRequest,
      config.BCRYPT_ROUNDS,
      config.RATE_LIMIT_WINDOW_MS,
      config.RATE_LIMIT_MAX,
      config.WORKER_CONCURRENCY,
    ].every((value) => typeof value === 'number')).toBe(true);
  });

  it('keeps MONGODB_URI as a string', () => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/config_test';
    __resetConfigForTests();
    expect(getConfig().MONGODB_URI).toBe('mongodb://localhost:27017/config_test');
    expect(typeof getConfig().MONGODB_URI).toBe('string');
  });

  it('requires MONGODB_URI', () => {
    delete process.env.MONGODB_URI;
    __resetConfigForTests();
    expect(() => getConfig()).toThrow(/MONGODB_URI/);
  });

  it('does not expose secrets in logs - redact check', async () => {
    const { redactSecrets } = await import('../../packages/logger/src/index');
    const redacted = redactSecrets({ password: 'secret123', token: 'abc', normal: 'ok' });
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.normal).toBe('ok');
  });
});

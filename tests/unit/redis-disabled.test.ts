import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { disconnectRedis, getRedis, getRedisStatus, pingRedis } from '../../apps/api/src/db/redis';

describe('Redis disabled configuration', () => {
  const originalRedisEnabled = process.env.REDIS_ENABLED;

  beforeEach(() => {
    process.env.REDIS_ENABLED = 'false';
    __resetConfigForTests();
  });

  afterEach(async () => {
    await disconnectRedis();
    if (originalRedisEnabled === undefined) delete process.env.REDIS_ENABLED;
    else process.env.REDIS_ENABLED = originalRedisEnabled;
    __resetConfigForTests();
  });

  it('does not create a Redis client or ping when disabled', async () => {
    expect(getRedisStatus().status).toBe('disabled');
    expect(await pingRedis()).toMatchObject({ status: 'disabled' });
    expect(() => getRedis()).toThrow(/Redis is disabled/);
  });
});

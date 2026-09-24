import Redis from 'ioredis';
import { getRedisConfig, isRedisEnabled } from '@erp/config';
import { logger } from '../lib/logger';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  if (!isRedisEnabled()) {
    throw new Error('Redis is disabled via REDIS_ENABLED=false');
  }
  const cfg = getRedisConfig();
  client = new Redis(cfg.url, {
    keyPrefix: cfg.prefix,
    enableReadyCheck: true,
    lazyConnect: false,
    maxRetriesPerRequest: cfg.maxRetriesPerRequest,
    retryStrategy: (times) => {
      if (times > cfg.maxRetriesPerRequest) {
        logger.warn({ attempts: times }, 'Redis max retries reached — will not retry further');
        return null; // stop retrying
      }
      const delay = Math.min(times * 1000, 5000);
      logger.warn({ attempt: times, delayMs: delay }, 'Redis reconnect attempt');
      return delay;
    },
    autoResubscribe: false,
    autoResendUnfulfilledCommands: false,
  });

  let errorCount = 0;
  const MAX_LOGGED_ERRORS = 3;

  client.on('connect', () => {
    logger.info('Redis connecting');
    errorCount = 0;
  });
  client.on('ready', () => {
    logger.info('Redis ready');
    errorCount = 0;
  });
  client.on('error', (err) => {
    errorCount++;
    if (errorCount <= MAX_LOGGED_ERRORS) {
      logger.error({ err: err.message, attempt: errorCount }, 'Redis error');
    } else if (errorCount === MAX_LOGGED_ERRORS + 1) {
      logger.error({ totalAttempts: errorCount }, 'Redis: suppressing further error logs');
    }
  });
  client.on('close', () => {
    logger.warn('Redis closed');
  });
  client.on('reconnecting', () => {
    logger.warn('Redis reconnecting');
  });
  return client;
}

export async function pingRedis(): Promise<{ status: 'ok' | 'down' | 'disabled'; latencyMs: number; message?: string }> {
  const start = Date.now();
  try {
    if (!isRedisEnabled()) {
      return { status: 'disabled', latencyMs: Date.now() - start, message: 'disabled by configuration' };
    }
    if (!client || client.status === 'close' || client.status === 'end') {
      return { status: 'down', latencyMs: Date.now() - start, message: 'redis not initialized' };
    }
    const r = getRedis();
    const res = await r.ping();
    const latencyMs = Date.now() - start;
    if (res === 'PONG') return { status: 'ok', latencyMs };
    return { status: 'down', latencyMs, message: `unexpected ping response ${res}` };
  } catch (err) {
    await disconnectRedis().catch(() => {});
    return { status: 'down', latencyMs: Date.now() - start, message: (err as Error).message };
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    try { await client.quit(); } catch { client.disconnect(); }
    client = null;
  }
}

export function getRedisStatus(): { status: 'ok' | 'down' | 'disabled'; message?: string } {
  if (!isRedisEnabled()) return { status: 'disabled', message: 'Redis disabled via config' };
  if (!client) return { status: 'down', message: 'not initialized' };
  if (client.status === 'ready') return { status: 'ok' };
  return { status: 'down', message: client.status };
}

import { getConfig } from '@erp/config';
import { createApp } from './app';
import { classifyMongoError, connectMongo, disconnectMongo } from '@erp/database';
import { getRedis, disconnectRedis } from './db/redis';
import { logger } from './lib/logger';

async function bootstrap() {
  // 1. Load & validate config (throws if invalid)
  const config = getConfig();
  logger.info({ env: config.NODE_ENV, port: config.server.port, dbName: config.MONGODB_DATABASE }, 'bootstrapping API');

  // 2. Connect MongoDB — mandatory SOR
  // In production, failure is fatal (fail fast). In dev/test, allow degraded for DX but log clearly.
  try {
    await connectMongo();
    logger.info('MongoDB Atlas connection verified');
  } catch (err) {
    const failure = classifyMongoError(err);
    if (config.NODE_ENV === 'production') {
      logger.fatal({ reason: failure.reason, code: failure.code }, 'MongoDB connection failed — refusing to start in production');
      throw err;
    }
    logger.warn({ reason: failure.reason, code: failure.code }, 'MongoDB initial connection failed — running in degraded mode (dev/test only)');
  }

  // 3. Redis — non-critical (cache/queues). Degraded is acceptable.
  if (config.redis.enabled) {
    try {
      const redis = getRedis();
      await redis.ping();
      logger.info('Redis ping ok');
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Redis initial connection failed — degraded mode');
    }
  } else {
    logger.info('Redis disabled via REDIS_ENABLED=false');
  }

  const app = createApp();

  const server = app.listen(config.server.port, () => {
    logger.info({ port: config.server.port, env: config.NODE_ENV, version: '0.1.0' }, 'API listening');
  });

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down — stop accepting new connections');
    server.close(async () => {
      logger.info('HTTP server closed — draining connections');
      const results = await Promise.allSettled([disconnectMongo(), disconnectRedis()]);
      for (const r of results) if (r.status === 'rejected') logger.error({ err: (r.reason as Error).message }, 'error during disconnect');
      logger.info('shutdown complete');
      process.exit(0);
    });
    // force exit if not closed in 10s
    setTimeout(() => {
      logger.error('graceful shutdown timeout — forcing exit');
      process.exit(1);
    }, 10000).unref();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err: err.message, stack: err.stack }, 'uncaughtException');
    void shutdown('uncaughtException');
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: String(reason) }, 'unhandledRejection');
    void shutdown('unhandledRejection');
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err: (err as Error).message, stack: (err as Error).stack }, 'failed to bootstrap');
  process.exit(1);
});

import { getConfig } from '@erp/config';
import { createLogger } from '@erp/logger';
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';

const logger = createLogger('worker');

async function main() {
  const config = getConfig();
  if (!config.redis.enabled) {
    logger.info('Redis disabled via REDIS_ENABLED=false; worker not started');
    return;
  }

  const connection = new IORedis(config.redis.url, { maxRetriesPerRequest: null, enableReadyCheck: false });
  connection.on('error', (err) => logger.error({ err: err.message }, 'redis error'));

  // Example queue - foundation only, no business jobs yet
  const queueName = 'default';
  const queuePrefix = config.BULLMQ_PREFIX;
  const queue = new Queue(queueName, { connection, prefix: queuePrefix });
  logger.info({ queueName, queuePrefix }, 'queue ready');

  const worker = new Worker(
    queueName,
    async (job) => {
      logger.info({ jobId: job.id, name: job.name }, 'processing job');
      // Placeholder - future modules will add processors for email, PDF, imports, etc.
      return { processed: true, jobId: job.id };
    },
    { connection, concurrency: config.WORKER_CONCURRENCY, prefix: queuePrefix }
  );

  worker.on('completed', (job) => logger.info({ jobId: job.id }, 'job completed'));
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'job failed'));
  worker.on('error', (err) => logger.error({ err: err.message }, 'worker error'));

  logger.info({ concurrency: config.WORKER_CONCURRENCY }, 'worker started');

  const shutdown = async () => {
    logger.info('shutting down worker');
    await worker.close();
    await queue.close();
    connection.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

main().catch((err) => {
  logger.fatal({ err }, 'worker failed to start');
  process.exit(1);
});

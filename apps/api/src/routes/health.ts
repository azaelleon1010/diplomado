import { Router, Request, Response } from 'express';
import { pingMongo } from '@erp/database';
import { pingRedis } from '../db/redis';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  const started = Date.now();
  const [mongo, redis] = await Promise.all([
    pingMongo().catch((e) => ({ status: 'down' as const, latencyMs: 0, message: (e as Error).message })),
    pingRedis().catch((e) => ({ status: 'down' as const, latencyMs: 0, message: (e as Error).message })),
  ]);
  const deps: Record<string, { status: string; latencyMs?: number; message?: string }> = {
    mongodb: mongo,
    redis: redis,
  };
  let status: 'ok' | 'degraded' | 'down' = 'ok';
  if (mongo.status === 'down') status = 'down';
  else if (redis.status === 'down' || redis.status === 'disabled') status = 'degraded';
  const httpStatus = status === 'down' ? 503 : 200;
  res.status(httpStatus).json({
    success: status !== 'down',
    data: {
      status,
      version: process.env.npm_package_version || '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: deps,
      responseTimeMs: Date.now() - started,
    },
    traceId: req.traceId,
  });
});

healthRouter.get('/live', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() }, traceId: (_req as Request).traceId });
});

healthRouter.get('/ready', async (req: Request, res: Response) => {
  const [mongo, redis] = await Promise.all([
    pingMongo().catch((e) => ({ status: 'down' as const, latencyMs: 0, message: (e as Error).message })),
    pingRedis().catch((e) => ({ status: 'down' as const, latencyMs: 0, message: (e as Error).message })),
  ]);
  const ready = mongo.status === 'ok' && (redis.status === 'ok' || redis.status === 'disabled');
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: { ready, dependencies: { mongodb: mongo, redis } },
    traceId: req.traceId,
    ...(ready ? {} : { error: { code: 'NOT_READY', message: 'Dependencies not ready', fields: { mongodb: mongo, redis } } }),
  });
});

/** Dedicated DB health — satisfies GET /health/db requirement */
healthRouter.get('/db', async (req: Request, res: Response) => {
  const mongo = await pingMongo().catch((e) => ({ status: 'down' as const, latencyMs: 0, message: (e as Error).message }));
  const ok = mongo.status === 'ok';
  res.status(ok ? 200 : 503).json({
    success: ok,
    data: { mongodb: mongo, timestamp: new Date().toISOString() },
    traceId: req.traceId,
    ...(ok ? {} : { error: { code: 'DB_UNAVAILABLE', message: 'MongoDB not ready', fields: { mongodb: mongo } } }),
  });
});

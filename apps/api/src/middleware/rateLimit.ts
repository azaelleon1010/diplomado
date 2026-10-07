/**
 * Fixed-window in-memory rate limiter for public auth endpoints.
 *
 * Per-instance state (Redis is disabled in this deployment). Good enough to
 * stop credential stuffing and mass tenant creation on a single instance;
 * with horizontal scaling each instance enforces its own window.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@erp/errors';

export interface RateLimitOptions {
  /** Stable name; part of the bucket key. */
  name: string;
  windowMs: number;
  max: number;
  /** Bucket key for the request; null skips limiting. */
  key: (req: Request) => string | null;
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 50_000;

export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const now = options.now ?? Date.now;
  let nextSweep = now() + options.windowMs;

  function sweep(at: number): void {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= at) buckets.delete(key);
    }
    nextSweep = at + options.windowMs;
  }

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const id = options.key(req);
    if (id === null) {
      next();
      return;
    }

    const at = now();
    if (at >= nextSweep || buckets.size > MAX_BUCKETS) sweep(at);

    const key = `${options.name}:${id}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= at) {
      bucket = { count: 0, resetAt: at + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - at) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(
        new AppError({
          code: 'RATE_LIMITED',
          message: `Demasiados intentos. Intenta de nuevo en ${retryAfterSeconds} segundos.`,
          statusCode: 429,
          fields: { retryAfterSeconds },
        }),
      );
      return;
    }
    next();
  };
}

/** Client address as seen through the configured trusted proxies. */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/** Login bucket per client + account (email within tenant), case-insensitive. */
export function loginAccountKey(req: Request): string | null {
  const body = (req.body ?? {}) as { email?: unknown; tenantId?: unknown };
  if (typeof body.email !== 'string' || body.email.trim() === '') return null;
  const tenant = typeof body.tenantId === 'string' ? body.tenantId.trim() : '';
  return `${clientIp(req)}|${tenant}|${body.email.trim().toLowerCase()}`;
}

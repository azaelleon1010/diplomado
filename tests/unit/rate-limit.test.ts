import { describe, it, expect } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { createRateLimiter, loginAccountKey } from '../../apps/api/src/middleware/rateLimit';

function run(limiter: ReturnType<typeof createRateLimiter>, req: Partial<Request>) {
  const headers: Record<string, string> = {};
  let error: unknown = undefined;
  const res = { setHeader: (k: string, v: string) => { headers[k] = v; } } as unknown as Response;
  limiter(req as Request, res, ((err?: unknown) => { error = err; }) as NextFunction);
  return { error, headers };
}

describe('fixed-window rate limiter', () => {
  it('allows up to max per window, then answers 429 with Retry-After', () => {
    let clock = 0;
    const limiter = createRateLimiter({ name: 't', windowMs: 60_000, max: 2, key: () => 'k', now: () => clock });
    expect(run(limiter, {}).error).toBeUndefined();
    expect(run(limiter, {}).error).toBeUndefined();
    clock = 15_000;
    const blocked = run(limiter, {});
    expect(blocked.error).toMatchObject({ code: 'RATE_LIMITED', statusCode: 429, fields: { retryAfterSeconds: 45 } });
    expect(blocked.headers['Retry-After']).toBe('45');
  });

  it('opens a new window after windowMs', () => {
    let clock = 0;
    const limiter = createRateLimiter({ name: 't', windowMs: 1_000, max: 1, key: () => 'k', now: () => clock });
    run(limiter, {});
    expect(run(limiter, {}).error).toBeDefined();
    clock = 1_000;
    expect(run(limiter, {}).error).toBeUndefined();
  });

  it('keeps buckets independent and skips requests without a key', () => {
    const limiter = createRateLimiter({ name: 't', windowMs: 60_000, max: 1, key: (req) => (req.ip as string | undefined) ?? null });
    expect(run(limiter, { ip: 'a' }).error).toBeUndefined();
    expect(run(limiter, { ip: 'b' }).error).toBeUndefined();
    expect(run(limiter, { ip: 'a' }).error).toBeDefined();
    expect(run(limiter, {}).error).toBeUndefined();
    expect(run(limiter, {}).error).toBeUndefined();
  });

  it('builds case-insensitive login keys per client, tenant and email', () => {
    const base = { ip: '1.1.1.1', socket: {} } as unknown as Request;
    expect(loginAccountKey({ ...base, body: { email: ' A@B.mx ', tenantId: 't1' } } as Request)).toBe('1.1.1.1|t1|a@b.mx');
    expect(loginAccountKey({ ...base, body: {} } as Request)).toBeNull();
  });
});

describe('trust proxy configuration', () => {
  it('trusts one proxy hop in production by default and none elsewhere', async () => {
    const { getConfig, __resetConfigForTests } = await import('../../packages/config/src/index');
    const saved = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET, TRUST_PROXY: process.env.TRUST_PROXY, MONGODB_URI: process.env.MONGODB_URI };
    try {
      process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/x';
      delete process.env.TRUST_PROXY;
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'a-secure-production-secret-with-32-chars!';
      __resetConfigForTests();
      expect(getConfig().server.trustProxy).toBe(1);

      process.env.TRUST_PROXY = 'false';
      __resetConfigForTests();
      expect(getConfig().server.trustProxy).toBe(false);

      delete process.env.TRUST_PROXY;
      process.env.NODE_ENV = 'development';
      __resetConfigForTests();
      expect(getConfig().server.trustProxy).toBe(false);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      __resetConfigForTests();
    }
  });
});

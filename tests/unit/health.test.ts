import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app';

describe('health endpoints', () => {
  const app = createApp();

  it('GET / returns api info with traceId', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toMatch(/ERP Platform API/);
    expect(res.body.traceId).toBeDefined();
  });

  it('GET /api/v1/openapi.json returns spec', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.openapi).toBe('3.0.3');
  });

  it('GET /api/v1/health/live returns ok', async () => {
    const res = await request(app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/health returns dependencies object and traceId', async () => {
    const res = await request(app).get('/api/v1/health');
    // degraded/down is ok in test without DB/Redis, but must return structured response
    expect([200, 503]).toContain(res.status);
    expect(res.body.traceId).toBeDefined();
    expect(res.body.data.dependencies).toHaveProperty('mongodb');
    expect(res.body.data.dependencies).toHaveProperty('redis');
    expect(res.body.success).toBe(res.status !== 503);
  });

  it('reports Redis disabled without requiring it for readiness', async () => {
    const previousRedisEnabled = process.env.REDIS_ENABLED;
    process.env.REDIS_ENABLED = 'false';
    const { __resetConfigForTests } = await import('../../packages/config/src/index');
    __resetConfigForTests();
    try {
      const res = await request(app).get('/api/v1/health');
      expect(res.body.data.dependencies.redis.status).toBe('disabled');
      const ready = await request(app).get('/api/v1/health/ready');
      expect(ready.status).toBe(ready.body.data.dependencies.mongodb.status === 'ok' ? 200 : 503);
    } finally {
      if (previousRedisEnabled === undefined) delete process.env.REDIS_ENABLED;
      else process.env.REDIS_ENABLED = previousRedisEnabled;
      __resetConfigForTests();
    }
  });

  it('propagates x-trace-id header', async () => {
    const traceId = 'test-trace-123';
    const res = await request(app).get('/api/v1/health/live').set('x-trace-id', traceId);
    expect(res.body.traceId).toBe(traceId);
  });

  it('uses configured trace and request header names', async () => {
    const previousTraceHeader = process.env.TRACE_HEADER;
    const previousRequestIdHeader = process.env.REQUEST_ID_HEADER;
    const { __resetConfigForTests } = await import('../../packages/config/src/index');
    process.env.TRACE_HEADER = 'x-correlation-id';
    process.env.REQUEST_ID_HEADER = 'x-correlation-request-id';
    __resetConfigForTests();
    try {
      const traceId = 'custom-trace-123';
      const res = await request(app).get('/api/v1/health/live').set('x-correlation-id', traceId);
      expect(res.body.traceId).toBe(traceId);
    } finally {
      if (previousTraceHeader === undefined) delete process.env.TRACE_HEADER;
      else process.env.TRACE_HEADER = previousTraceHeader;
      if (previousRequestIdHeader === undefined) delete process.env.REQUEST_ID_HEADER;
      else process.env.REQUEST_ID_HEADER = previousRequestIdHeader;
      __resetConfigForTests();
    }
  });

  it('404 returns structured error', async () => {
    const res = await request(app).get('/api/v1/not-existing-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.traceId).toBeDefined();
  });
});

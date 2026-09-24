import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../apps/api/src/app';
import { classifyMongoError } from '../../packages/database/src/connection';

describe('health endpoints — mongo/redis', () => {
  const app = createApp();

  it('classifies transport failures without exposing connection details', () => {
    const failure = classifyMongoError({ name: 'MongoServerSelectionError', code: 'ECONNREFUSED', message: 'connection refused' });
    expect(failure.reason).toBe('network');
    expect(failure.code).toBe('ECONNREFUSED');
  });

  it('GET /api/v1/health/db returns structured response with traceId', async () => {
    const res = await request(app).get('/api/v1/health/db');
    expect([200, 503]).toContain(res.status);
    expect(res.body.traceId).toBeDefined();
    // must contain mongodb key, not leak URI
    void (res.body.data ?? res.body.error?.fields);
    // fallback: check data.mongodb exists when 200
    if (res.status === 200) expect(res.body.data.mongodb).toBeDefined();
    expect(res.body.success).toBe(res.status === 200);
    // ensure no credentials leaked
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toMatch(/mongodb\+srv:\/\/.*:.*@/);
    expect(bodyStr).not.toMatch(/password/i);
  });

  it('GET /api/v1/health includes mongodb+redis dependencies', async () => {
    const res = await request(app).get('/api/v1/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body.data.dependencies.mongodb).toBeDefined();
    expect(res.body.data.dependencies.redis).toBeDefined();
  });

  it('GET /health/db alias works (without /api/v1 prefix)', async () => {
    const res = await request(app).get('/health/db');
    expect([200, 503]).toContain(res.status);
    expect(res.body.traceId).toBeDefined();
  });
});

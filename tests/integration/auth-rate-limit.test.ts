import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Express } from 'express';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { createApp } from '../../apps/api/src/app';
import { applicationModels } from '../../apps/api/src/infrastructure/models';
import { buildIdentityDeps } from '../../apps/api/src/modules/identity/presentation/routes';

let mongod: MongoMemoryReplSet | undefined;
let app: Express;
const stamp = Date.now().toString(36);
const LIMIT_ENV = ['TRUST_PROXY', 'AUTH_LOGIN_MAX_PER_ACCOUNT', 'AUTH_LOGIN_MAX_PER_IP', 'AUTH_REGISTER_MAX_PER_IP'];

describe('auth rate limiting', () => {
  beforeAll(async () => {
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      process.env.MONGODB_URI = mongod.getUri();
    }
    process.env.MONGODB_DATABASE = 'test_auth_rate_limit';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'integration-test-secret-32-chars-min!!';
    process.env.BCRYPT_ROUNDS = '4';
    process.env.TRUST_PROXY = '1';
    process.env.AUTH_LOGIN_MAX_PER_ACCOUNT = '3';
    process.env.AUTH_LOGIN_MAX_PER_IP = '6';
    process.env.AUTH_REGISTER_MAX_PER_IP = '1';
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    __resetConfigForTests();
    await disconnectMongo().catch(() => {});
    await connectMongo();
    await ensureIndexes(applicationModels);
    app = createApp(buildIdentityDeps({ async sendWelcomeEmail() {} }));
  }, 90000);

  afterAll(async () => {
    for (const key of LIMIT_ENV) delete process.env[key];
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  const login = (ip: string, email: string) =>
    request(app).post('/api/v1/auth/login').set('X-Forwarded-For', ip).send({ email, password: 'wrong-password' });

  it('blocks repeated attempts on one account with 429 and Retry-After', async () => {
    for (let i = 0; i < 3; i++) expect((await login('10.0.0.1', `victim.${stamp}@x.mx`)).status).toBe(401);
    const blocked = await login('10.0.0.1', `VICTIM.${stamp}@x.mx`);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('does not lock other clients or accounts (per-IP via trusted proxy)', async () => {
    expect((await login('10.0.0.2', `victim.${stamp}@x.mx`)).status).toBe(401);
    expect((await login('10.0.0.1', `other.${stamp}@x.mx`)).status).toBe(401);
  });

  it('caps total login attempts per client address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push((await login('10.0.0.3', `spray${i}.${stamp}@x.mx`)).status);
    // 10.0.0.3 is fresh; 6 per IP: these 4 pass, then the IP bucket runs out.
    expect(statuses).toEqual([401, 401, 401, 401]);
    expect((await login('10.0.0.3', `spray5.${stamp}@x.mx`)).status).toBe(401);
    expect((await login('10.0.0.3', `spray6.${stamp}@x.mx`)).status).toBe(401);
    expect((await login('10.0.0.3', `spray7.${stamp}@x.mx`)).status).toBe(429);
  });

  it('limits company registration per client address', async () => {
    const body = { companyName: `Empresa ${stamp}`, username: `owner.${stamp}`, email: `owner.${stamp}@x.mx`, password: 'Password123' };
    expect((await request(app).post('/api/v1/auth/register').set('X-Forwarded-For', '10.0.0.9').send(body)).status).toBe(201);
    const second = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Forwarded-For', '10.0.0.9')
      .send({ ...body, companyName: `Empresa 2 ${stamp}`, email: `owner2.${stamp}@x.mx` });
    expect(second.status).toBe(429);
  });
});

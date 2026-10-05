import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { createApp } from '../../apps/api/src/app';
import { applicationModels } from '../../apps/api/src/infrastructure/models';
import { buildIdentityDeps } from '../../apps/api/src/modules/identity/presentation/routes';
import type { IEmailProvider } from '../../apps/api/src/modules/notifications/domain/ports';
import type { Express } from 'express';

let mongod: MongoMemoryReplSet | undefined;
let app: Express;

const stamp = Date.now().toString(36);

const company = (n: string) => ({
  companyName: n,
  username: `owner.${stamp}`,
  email: `owner.${stamp}@example.mx`,
  password: 'Password123',
  firstName: 'Dueña',
  lastName: 'Prueba',
});

describe('Register vertical slice: company -> tenant -> session -> dashboard data', () => {
  const testEmailProvider: IEmailProvider = {
    async sendWelcomeEmail() {},
  };

  beforeAll(async () => {
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      process.env.MONGODB_URI = mongod.getUri();
    }

    process.env.MONGODB_DATABASE = 'test_register';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'integration-test-secret-32-chars-min!!';
    process.env.BCRYPT_ROUNDS = '4';

    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;

    __resetConfigForTests();

    await disconnectMongo().catch(() => {});
    await connectMongo();

    await ensureIndexes(applicationModels);

    for (const model of applicationModels) {
      await model.deleteMany({});
    }

    const identityDeps = buildIdentityDeps(testEmailProvider);
    app = createApp(identityDeps);
  });

  afterAll(async () => {
    await disconnectMongo().catch(() => {});

    if (mongod) {
      await mongod.stop();
    }

    __resetConfigForTests();
  });

  let accessToken = '';
  let refreshToken = '';
  let tenantId = '';

  it('registers a company and returns a login-shaped session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(company('Acme Textil'));

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;

    expect(data.accessToken).toBeTruthy();
    expect(data.refreshToken).toBeTruthy();
    expect(data.tokenType).toBe('Bearer');
    expect(data.tenantId).toMatch(/^tnt_[0-9a-f]{16}$/);
    expect(data.sessionId).toBeTruthy();
    expect(data.user.email).toBe(company('Acme Textil').email);
    expect(data.user.username).toBe(company('Acme Textil').username);
    expect(data.permissions).toContain('system.users.write');
    expect(data.tenant.slug).toBe('acme-textil');

    const raw = JSON.stringify(res.body);

    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('Password123');

    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    tenantId = data.tenantId;
  });

  it('resolves slug collisions deterministically', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...company('Acme Textil'),
        username: `owner2.${stamp}`,
        email: `owner2.${stamp}@example.mx`,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.tenant.slug).not.toBe('acme-textil');
    expect(res.body.data.tenant.slug.startsWith('acme-textil-')).toBe(true);
    expect(res.body.data.tenantId).not.toBe(tenantId);
  });

  it('ignores client-supplied tenantId (strict schema)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...company('Otra Empresa'),
        tenantId: 'tnt_hacked',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid input', async () => {
    const short = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...company('Corta Pass'),
        email: `c.${stamp}@example.mx`,
        username: `c.${stamp}`,
        password: 'short',
      });

    expect(short.status).toBe(400);

    const noCompany = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...company('X'),
        companyName: '',
        email: `d.${stamp}@example.mx`,
        username: `d.${stamp}`,
      });

    expect(noCompany.status).toBe(400);

    const badEmail = await request(app)
      .post('/api/v1/auth/register')
      .send({
        ...company('Mail Malo'),
        email: 'not-an-email',
        username: `e.${stamp}`,
      });

    expect(badEmail.status).toBe(400);
  });

  it('new owner can login, fetch /me, refresh and logout', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: company('Acme Textil').email,
        password: 'Password123',
      });

    expect(login.status).toBe(200);
    expect(login.body.data.tenantId).toBe(tenantId);

    const me = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(company('Acme Textil').email);
    expect(me.body.data.permissions).toContain('system.users.write');

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: login.body.data.refreshToken,
      });

    expect(rotated.status).toBe(200);

    const out = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${rotated.body.data.accessToken}`);

    expect(out.status).toBe(200);

    const gone = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${rotated.body.data.accessToken}`);

    expect(gone.status).toBe(401);
  });

  it('original session from register stays valid until logout', async () => {
    const me = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(me.status).toBe(200);

    const out = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(out.status).toBe(200);

    const stale = await request(app)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken,
      });

    expect(stale.status).toBe(401);
  });
});

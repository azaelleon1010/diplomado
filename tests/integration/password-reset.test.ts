import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { createApp } from '../../apps/api/src/app';
import { buildIdentityDeps } from '../../apps/api/src/modules/identity/presentation/routes';
import { identityModels } from '../../apps/api/src/modules/identity/infrastructure/models';
import { tenantModels } from '../../apps/api/src/modules/tenant/infrastructure/models';
import type { PasswordResetDeps } from '../../apps/api/src/modules/identity/application/passwordReset';
import type { IEmailProvider, PasswordResetEmailInput } from '../../apps/api/src/modules/notifications/domain/ports';
import type { Express } from 'express';

let mongod: MongoMemoryReplSet | undefined;
let app: Express;
let deps: PasswordResetDeps;
const sentEmails: PasswordResetEmailInput[] = [];

function lastResetLink(): { resetId: string; token: string } {
  const last = sentEmails.at(-1);
  if (!last) throw new Error('No password reset email was sent');
  const url = new URL(last.resetUrl);
  return { resetId: url.searchParams.get('rid') ?? '', token: url.searchParams.get('token') ?? '' };
}

describe('Password reset integration: forgot-password → reset-password → login', () => {
  const emailProvider: IEmailProvider = {
    async sendWelcomeEmail() {},
    async sendPasswordResetEmail(input) {
      sentEmails.push(input);
    },
  };

  beforeAll(async () => {
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      // Register uses a MongoDB transaction — needs a replica set, not a standalone instance.
      mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      process.env.MONGODB_URI = mongod.getUri();
    }
    process.env.MONGODB_DATABASE = 'test_password_reset';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'integration-test-secret-32-chars-min!!';
    process.env.BCRYPT_ROUNDS = '4';
    process.env.AUTH_PASSWORD_RESET_TTL_MINUTES = '60';
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.RESEND_API_KEY;

    __resetConfigForTests();
    await disconnectMongo().catch(() => {});
    await connectMongo();
    await ensureIndexes([...identityModels, ...tenantModels]);

    deps = buildIdentityDeps(emailProvider);
    app = createApp(deps);
  });

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('always answers 200 and never reveals whether the email exists', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'nobody@nowhere.mx' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { requested: true } });
    expect(sentEmails).toHaveLength(0);
  });

  it('registers a company, requests a reset, resets the password, and logs in only with the new one', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ companyName: 'Reset Co', username: 'owner.reset', email: 'owner@reset.mx', password: 'OldPassword1' });
    expect(register.status).toBe(201);
    const tenantId = register.body.data.tenantId as string;

    const forgot = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'owner@reset.mx', tenantId });
    expect(forgot.status).toBe(200);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0]?.to).toBe('owner@reset.mx');

    const { resetId, token } = lastResetLink();
    const reset = await request(app).post('/api/v1/auth/reset-password').send({ resetId, token, newPassword: 'NewPassword1' });
    expect(reset.status).toBe(200);
    expect(reset.body.data).toEqual({ success: true });

    const loginOld = await request(app).post('/api/v1/auth/login').send({ email: 'owner@reset.mx', password: 'OldPassword1', tenantId });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(app).post('/api/v1/auth/login').send({ email: 'owner@reset.mx', password: 'NewPassword1', tenantId });
    expect(loginNew.status).toBe(200);
    expect(loginNew.body.data.accessToken).toBeTruthy();
  });

  it('revokes the refresh session that existed before the reset', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ companyName: 'Revoke Co', username: 'owner.revoke', email: 'owner@revoke.mx', password: 'OldPassword1' });
    expect(register.status).toBe(201);
    const tenantId = register.body.data.tenantId as string;
    const refreshToken = register.body.data.refreshToken as string;

    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'owner@revoke.mx', tenantId });
    const { resetId, token } = lastResetLink();
    await request(app).post('/api/v1/auth/reset-password').send({ resetId, token, newPassword: 'NewPassword1' });

    const refreshAttempt = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refreshAttempt.status).toBe(401);
  });

  it('rejects reusing a reset link twice', async () => {
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ companyName: 'Reuse Co', username: 'owner.reuse', email: 'owner@reuse.mx', password: 'OldPassword1' });
    const tenantId = register.body.data.tenantId as string;

    await request(app).post('/api/v1/auth/forgot-password').send({ email: 'owner@reuse.mx', tenantId });
    const { resetId, token } = lastResetLink();

    const first = await request(app).post('/api/v1/auth/reset-password').send({ resetId, token, newPassword: 'NewPassword1' });
    expect(first.status).toBe(200);

    const second = await request(app).post('/api/v1/auth/reset-password').send({ resetId, token, newPassword: 'AnotherPass1' });
    expect(second.status).toBe(401);
  });

  it('rejects a malformed reset-password body (schema validation)', async () => {
    const res = await request(app).post('/api/v1/auth/reset-password').send({ resetId: 'x', token: 'too-short', newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

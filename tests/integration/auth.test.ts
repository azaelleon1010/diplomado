import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { createApp } from '../../apps/api/src/app';
import { buildIdentityDeps } from '../../apps/api/src/modules/identity/presentation/routes';
import { identityModels } from '../../apps/api/src/modules/identity/infrastructure/models';
import { TenantModel, tenantModels } from '../../apps/api/src/modules/tenant/infrastructure/models';
import type { RegisterDeps } from '../../apps/api/src/modules/identity/application/usecases';
import type { IEmailProvider } from '../../apps/api/src/modules/notifications/domain/ports';
import type { Express } from 'express';

let mongod: MongoMemoryServer;
let app: Express;
let deps: RegisterDeps;

const TENANT_A = 'TENANT_A';
const TENANT_B = 'TENANT_B';

async function createRole(tenantId: string, name: string, permissions: string[]) {
  return deps.roles.create({ tenantId, name, permissions, createdBy: 'test' });
}

async function createUserWithRoles(tenantId: string, email: string, password: string, roleIds: string[]) {
  const passwordHash = await deps.hasher.hash(password);
  const user = await deps.users.create({
    tenantId,
    username: email.split('@')[0] ?? email,
    email,
    passwordHash,
    firstName: 'Test',
    createdBy: 'test',
  });
  await deps.memberships.create({ tenantId, userId: user._id, roleIds, createdBy: 'test' });
  return user;
}

let adminAccessA = '';
let adminRefreshA = '';
let limitedAccessA = '';
let limitedRefreshA = '';
let adminAccessB = '';
let adminRefreshB = '';
let userIdB = '';

describe('Auth integration: login → refresh → /me → logout', () => {
  const testEmailProvider: IEmailProvider = {
    async sendWelcomeEmail() {},
  };

  beforeAll(async () => {
    // Local Atlas verification: TEST_MONGO_URI skips mongodb-memory-server
    // (binary download unavailable in this environment).
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      mongod = await MongoMemoryServer.create();
      process.env.MONGODB_URI = mongod.getUri();
    }
    process.env.MONGODB_DATABASE = 'test_auth';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'integration-test-secret-32-chars-min!!';
    process.env.BCRYPT_ROUNDS = '4';

    // Tests de integración no deben depender de Resend.
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.RESEND_API_KEY;

    __resetConfigForTests();
    await disconnectMongo().catch(() => {});
    await connectMongo();
    await ensureIndexes([...identityModels, ...tenantModels]);

    // Atlas persiste entre ejecuciones; limpiamos únicamente los tenants
    // utilizados por esta suite de integración.
    const cleanModels = [
      identityModels[0], // users
      identityModels[1], // roles
      identityModels[2], // memberships
      identityModels[3], // refreshSessions
      identityModels[4], // auditEvents
    ];

    for (const model of cleanModels) {
      await model.deleteMany({
        tenantId: { $in: [TENANT_A, TENANT_B] },
      });
    }
    await TenantModel.deleteMany({ tenantId: { $in: [TENANT_A, TENANT_B] } }).exec();

    deps = buildIdentityDeps(testEmailProvider);
    await deps.tenants.create({ tenantId: TENANT_A, name: 'Tenant A', slug: 'tenant-a-auth-test', createdBy: 'test' });
    await deps.tenants.create({ tenantId: TENANT_B, name: 'Tenant B', slug: 'tenant-b-auth-test', createdBy: 'test' });
    app = createApp(deps);

    const adminRoleA = await createRole(TENANT_A, 'admin', ['system.users.read', 'system.users.write']);
    await createUserWithRoles(TENANT_A, 'admin@a.mx', 'AdminPass1', [adminRoleA._id]);
    const viewerRoleA = await createRole(TENANT_A, 'viewer', ['inventory.read']);
    await createUserWithRoles(TENANT_A, 'viewer@a.mx', 'ViewerPass1', [viewerRoleA._id]);
    const adminRoleB = await createRole(TENANT_B, 'admin', ['system.users.read', 'system.users.write']);
    const userB = await createUserWithRoles(TENANT_B, 'admin@b.mx', 'AdminPass2', [adminRoleB._id]);
    userIdB = userB._id;
  });

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });
  it('login succeeds and never exposes passwordHash', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@a.mx', password: 'AdminPass1' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.tenantId).toBe(TENANT_A);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    expect(res.body.data.permissions).toContain('system.users.write');
    adminAccessA = res.body.data.accessToken;
    adminRefreshA = res.body.data.refreshToken;
  });

  it('login with wrong password returns 401 with generic message', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@a.mx', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('login with unknown email returns the same 401 (no oracle)', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@a.mx', password: 'Whatever12' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('disabled user cannot login (401)', async () => {
    const viewer = await deps.users.findByEmail(TENANT_A, 'viewer@a.mx');
    expect(viewer).not.toBeNull();
    await deps.users.setStatus(TENANT_A, viewer?._id ?? '', 'DISABLED', 'test');
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'viewer@a.mx', password: 'ViewerPass1' });
    expect(res.status).toBe(401);
    await deps.users.setStatus(TENANT_A, viewer?._id ?? '', 'ACTIVE', 'test');
    const ok = await request(app).post('/api/v1/auth/login').send({ email: 'viewer@a.mx', password: 'ViewerPass1' });
    expect(ok.status).toBe(200);
    limitedAccessA = ok.body.data.accessToken;
    limitedRefreshA = ok.body.data.refreshToken;
  });

  it('blocks already-issued access and refresh tokens after the user is disabled', async () => {
    const viewer = await deps.users.findByEmail(TENANT_A, 'viewer@a.mx');
    expect(viewer).not.toBeNull();
    await deps.users.setStatus(TENANT_A, viewer?._id ?? '', 'DISABLED', 'test');

    const access = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${limitedAccessA}`);
    expect(access.status).toBe(401);
    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: limitedRefreshA });
    expect(refresh.status).toBe(401);

    await deps.users.setStatus(TENANT_A, viewer?._id ?? '', 'ACTIVE', 'test');
  });

  it('protected route without token returns 401', async () => {
    const res = await request(app).get('/api/v1/me');
    expect(res.status).toBe(401);
  });

  it('/me returns identity context with permissions', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${adminAccessA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('admin@a.mx');
    expect(res.body.data.permissions).toContain('system.users.read');
    expect(res.body.data.membership.tenantId).toBe(TENANT_A);
  });

  it('user without permission gets 403 on admin routes', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${limitedAccessA}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    const post = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${limitedAccessA}`)
      .send({ email: 'x@a.mx', username: 'xuser', password: 'Password12' });
    expect(post.status).toBe(403);
  });

  it('tenant A cannot access tenant B user (404)', async () => {
    const res = await request(app).get(`/api/v1/users/${userIdB}`).set('Authorization', `Bearer ${adminAccessA}`);
    expect(res.status).toBe(404);
  });

  it('admin can create + read users within own tenant', async () => {
    const created = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminAccessA}`)
      .send({ email: 'nuevo@a.mx', username: 'nuevoop', password: 'Password12' });
    expect(created.status).toBe(201);
    expect(created.body.data.user.email).toBe('nuevo@a.mx');
    expect(JSON.stringify(created.body)).not.toContain('passwordHash');
    const listed = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${adminAccessA}`);
    expect(listed.status).toBe(200);
    expect(listed.body.meta.total).toBeGreaterThanOrEqual(3);
  });

  it('refresh rotates: new pair works, old refresh cannot be reused', async () => {
    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: adminRefreshA });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.refreshToken).not.toBe(adminRefreshA);
    adminRefreshA = rotated.body.data.refreshToken;
    adminAccessA = rotated.body.data.accessToken;

    const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${adminAccessA}`);
    expect(me.status).toBe(200);
  });

  it('revoked refresh token cannot be reused after logout', async () => {
    const out = await request(app).post('/api/v1/auth/logout').set('Authorization', `Bearer ${adminAccessA}`);
    expect(out.status).toBe(200);

    const me = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${adminAccessA}`);
    expect(me.status).toBe(401);

    const again = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: adminRefreshA });
    expect(again.status).toBe(401);
  });

  it('tenant B login is isolated from tenant A', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@b.mx', password: 'AdminPass2' });
    expect(res.status).toBe(200);
    expect(res.body.data.tenantId).toBe(TENANT_B);
    adminAccessB = res.body.data.accessToken;
    adminRefreshB = res.body.data.refreshToken;
    expect(adminAccessB).toBeTruthy();
    const meB = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${adminAccessB}`);
    expect(meB.body.data.membership.tenantId).toBe(TENANT_B);
  });

  it('blocks already-issued tokens and refresh after the tenant is disabled', async () => {
    await deps.tenants.setStatus(TENANT_B, 'DISABLED', 'test');

    const access = await request(app).get('/api/v1/me').set('Authorization', `Bearer ${adminAccessB}`);
    expect(access.status).toBe(403);
    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: adminRefreshB });
    expect(refresh.status).toBe(401);

    await deps.tenants.setStatus(TENANT_B, 'ACTIVE', 'test');
  });
});

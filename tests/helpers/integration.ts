/**
 * Shared integration-test harness: real Express app + MongoDB replica set
 * in memory (transactions behave as on Atlas). TEST_MONGO_URI overrides the
 * in-memory server.
 */
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { Express } from 'express';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { connectMongo, disconnectMongo } from '../../packages/database/src/connection';
import { ensureIndexes } from '../../packages/database/src/indexes';
import { createApp } from '../../apps/api/src/app';
import { applicationModels } from '../../apps/api/src/infrastructure/models';
import { buildIdentityDeps } from '../../apps/api/src/modules/identity/presentation/routes';
import type { RegisterDeps } from '../../apps/api/src/modules/identity/application/usecases';

export interface Harness {
  app: Express;
  deps: RegisterDeps;
  stamp: string;
  stop(): Promise<void>;
}

export async function startHarness(database: string): Promise<Harness> {
  let mongod: MongoMemoryReplSet | undefined;
  if (process.env.TEST_MONGO_URI) {
    process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
  } else {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
  }
  process.env.MONGODB_DATABASE = database;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'integration-test-secret-32-chars-min!!';
  process.env.BCRYPT_ROUNDS = '4';
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
  __resetConfigForTests();
  await disconnectMongo().catch(() => {});
  await connectMongo();
  await ensureIndexes(applicationModels);
  const deps = buildIdentityDeps({ async sendWelcomeEmail() {} });
  return {
    app: createApp(deps),
    deps,
    stamp: Date.now().toString(36),
    async stop() {
      await disconnectMongo().catch(() => {});
      if (mongod) await mongod.stop();
      __resetConfigForTests();
    },
  };
}

export interface Company {
  token: string;
  tenantId: string;
  slug: string;
}

/** Registers a company through the public API (owner gets every permission). */
export async function registerCompany(h: Harness, name: string): Promise<Company> {
  const res = await request(h.app)
    .post('/api/v1/auth/register')
    .send({ companyName: `${name} ${h.stamp}`, username: `owner.${name.toLowerCase().replace(/\W/g, '')}.${h.stamp}`, email: `owner.${name.toLowerCase().replace(/\W/g, '')}.${h.stamp}@x.mx`, password: 'Password123' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.data.accessToken, tenantId: res.body.data.tenantId, slug: res.body.data.tenant.slug };
}

/** Creates a user with a custom role in the company and returns its token. */
export async function userWith(h: Harness, company: Company, permissions: string[], name: string): Promise<string> {
  const role = await h.deps.roles.create({ tenantId: company.tenantId, name: `${name}-${h.stamp}`, permissions, createdBy: 'test' });
  const email = `${name}.${h.stamp}@x.mx`;
  const created = await request(h.app)
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${company.token}`)
    .send({ email, username: `${name}.${h.stamp}`, password: 'Password123', roleIds: [role._id] });
  if (created.status !== 201) throw new Error(`user failed: ${created.status} ${JSON.stringify(created.body)}`);
  const login = await request(h.app).post('/api/v1/auth/login').send({ email, password: 'Password123', tenantId: company.tenantId });
  return login.body.data.accessToken as string;
}

/** Authenticated request helper bound to one token. */
export function client(h: Harness, token: string) {
  const call = (method: 'get' | 'post' | 'patch' | 'delete') => (path: string, body?: object) => {
    const req = request(h.app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
    return body === undefined ? req : req.send(body);
  };
  return { get: call('get'), post: call('post'), patch: call('patch'), delete: call('delete') };
}

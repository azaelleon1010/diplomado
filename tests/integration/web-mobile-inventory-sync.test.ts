/**
 * Web ↔ API ↔ MongoDB ↔ Mobile, without simulation of the sync itself.
 *
 * Two independent client sessions ("web" and "mobile") drive the real Express
 * app through the shared client contract both apps import
 * (packages/types/src/inventory.ts), logging in exactly like the apps do:
 * company slug → GET /auth/tenant/:slug → POST /auth/login { tenantId }.
 * Whatever one client writes must be visible to the other on the next read.
 */
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
import type { RegisterDeps } from '../../apps/api/src/modules/identity/application/usecases';
import type { IEmailProvider } from '../../apps/api/src/modules/notifications/domain/ports';
import {
  EMPTY_PRODUCT_FORM,
  createInventoryApi,
  isVersionConflict,
  productToFormValues,
  toCreateProductPayload,
  toUpdateProductPayload,
  validateProductForm,
  type InventoryApi,
  type InventoryRequestClient,
  type InventoryRequestOptions,
  type ProductFields,
  type ProductFormValues,
} from '../../packages/types/src/inventory';

let mongod: MongoMemoryReplSet | undefined;
let app: Express;
let deps: RegisterDeps;

const stamp = Date.now().toString(36);
const PASSWORD = 'Password123';

class ClientHttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

/** Same envelope handling as the apps' fetch clients, over supertest. */
function httpClient(): InventoryRequestClient {
  async function send(path: string, options: InventoryRequestOptions) {
    const method = (options.method ?? 'GET').toLowerCase() as 'get' | 'post' | 'patch' | 'delete';
    let req = request(app)[method](path).set('Authorization', `Bearer ${options.token}`);
    if (options.body !== undefined) req = req.send(options.body as object);
    const res = await req;
    if (res.status >= 400 || res.body?.success !== true) {
      throw new ClientHttpError(res.status, res.body?.error?.code ?? 'UNKNOWN', res.body?.error?.message ?? '');
    }
    return res.body as { data: unknown; meta?: Record<string, unknown> };
  }
  return {
    request: async <T>(path: string, options: InventoryRequestOptions) => (await send(path, options)).data as T,
    page: async <T>(path: string, options: InventoryRequestOptions) => {
      const body = await send(path, options);
      return { data: body.data as T, meta: body.meta };
    },
  };
}

interface ClientSession {
  name: string;
  token: string;
  tenantId: string;
  api: InventoryApi;
}

/** Exactly the Web/Mobile login flow: slug → tenantId → tenant-scoped login. */
async function loginLikeApps(name: string, company: string, email: string, password = PASSWORD): Promise<ClientSession> {
  const tenantRes = await request(app).get(`/api/v1/auth/tenant/${encodeURIComponent(company.trim())}`);
  expect(tenantRes.status).toBe(200);
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: email.trim(), password, tenantId: tenantRes.body.data.tenantId });
  expect(loginRes.status).toBe(200);
  return {
    name,
    token: loginRes.body.data.accessToken as string,
    tenantId: loginRes.body.data.tenantId as string,
    api: createInventoryApi(httpClient()),
  };
}

async function registerCompany(companyName: string, email: string) {
  const res = await request(app).post('/api/v1/auth/register').send({
    companyName,
    username: `owner.${stamp}.${companyName.length}`,
    email,
    password: PASSWORD,
  });
  expect(res.status).toBe(201);
  return res.body.data as { tenantId: string; tenant: { tenantId: string; name: string; slug: string } };
}

function fields(values: Partial<ProductFormValues>): ProductFields {
  const result = validateProductForm({ ...EMPTY_PRODUCT_FORM, ...values });
  if (!result.ok) throw new Error(`invalid test form: ${result.error}`);
  return result.fields;
}

describe('Web ↔ API ↔ MongoDB ↔ Mobile: shared tenant inventory', () => {
  const testEmailProvider: IEmailProvider = { async sendWelcomeEmail() {} };

  let companyA: Awaited<ReturnType<typeof registerCompany>>;
  let companyB: Awaited<ReturnType<typeof registerCompany>>;
  const ownerA = `owner.a.${stamp}@example.mx`;
  const ownerB = `owner.b.${stamp}@example.mx`;
  let web: ClientSession;
  let mobile: ClientSession;
  let otherTenant: ClientSession;
  let webProductId = '';
  let mobileProductId = '';

  beforeAll(async () => {
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      process.env.MONGODB_URI = mongod.getUri();
    }
    process.env.MONGODB_DATABASE = 'test_web_mobile_sync';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'integration-test-secret-32-chars-min!!';
    process.env.BCRYPT_ROUNDS = '4';
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    __resetConfigForTests();
    await disconnectMongo().catch(() => {});
    await connectMongo();
    await ensureIndexes(applicationModels);
    // No cleanup needed: every company/email is unique per run (stamp).
    deps = buildIdentityDeps(testEmailProvider);
    app = createApp(deps);

    companyA = await registerCompany(`Textiles Sync ${stamp}`, ownerA);
    companyB = await registerCompany(`Otra Empresa ${stamp}`, ownerB);

    mobile = await loginLikeApps('mobile', companyA.tenant.slug, ownerA);
    // The Web sends whatever the user typed; the API normalizes the slug.
    web = await loginLikeApps('web', `  ${companyA.tenant.slug.toUpperCase()} `, ownerA.toUpperCase());
    otherTenant = await loginLikeApps('other', companyB.tenant.slug, ownerB);
  }, 90000);

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('both clients are bound to the same tenant, user and permissions', async () => {
    expect(web.tenantId).toBe(companyA.tenantId);
    expect(mobile.tenantId).toBe(companyA.tenantId);
    const [meWeb, meMobile] = await Promise.all([
      request(app).get('/api/v1/me').set('Authorization', `Bearer ${web.token}`),
      request(app).get('/api/v1/me').set('Authorization', `Bearer ${mobile.token}`),
    ]);
    expect(meWeb.status).toBe(200);
    expect(meMobile.status).toBe(200);
    expect(meMobile.body.data.user._id).toBe(meWeb.body.data.user._id);
    expect(meMobile.body.data.membership.tenantId).toBe(companyA.tenantId);
    expect(meMobile.body.data.permissions).toEqual(meWeb.body.data.permissions);
  });

  it('prueba 1: Web creates a product and Mobile sees it on refresh', async () => {
    const created = await web.api.createProduct(
      web.token,
      toCreateProductPayload(fields({ sku: `web-${stamp}`, name: 'Hilo creado en Web', cost: '10.5', price: '20' })),
    );
    webProductId = created._id;
    expect(created.tenantId).toBe(companyA.tenantId);
    expect(created.sku).toBe(`WEB-${stamp}`.toUpperCase());

    const seenByMobile = await mobile.api.listProducts(mobile.token);
    expect(seenByMobile.map((p) => p._id)).toContain(webProductId);
  });

  it('prueba 2: Mobile creates a product and Web sees it on refresh', async () => {
    const created = await mobile.api.createProduct(
      mobile.token,
      toCreateProductPayload(fields({ sku: `mob-${stamp}`, name: 'Tela creada en Mobile', cost: '7,25', price: '15', maximumStock: '50' })),
    );
    mobileProductId = created._id;
    expect(created.cost).toBe(7.25);

    const page = await web.api.listProductsPage(web.token, { limit: 100 });
    expect(page.items.map((p) => p._id)).toContain(mobileProductId);
    expect(page.total).toBeGreaterThanOrEqual(2);
  });

  it('prueba 3: Web edits and Mobile sees the change', async () => {
    const current = await web.api.getProduct(web.token, mobileProductId);
    const updated = await web.api.updateProduct(
      web.token,
      mobileProductId,
      toUpdateProductPayload(fields({ ...productToFormValues(current), name: 'Tela editada en Web', price: '18' }), current.version),
    );
    expect(updated.version).toBe(current.version + 1);

    const seenByMobile = await mobile.api.getProduct(mobile.token, mobileProductId);
    expect(seenByMobile.name).toBe('Tela editada en Web');
    expect(seenByMobile.price).toBe(18);
    expect(seenByMobile.version).toBe(updated.version);
  });

  it('prueba 4: Mobile edits and Web sees the change; stale versions are rejected', async () => {
    const stale = await mobile.api.getProduct(mobile.token, webProductId);
    // Web saves first...
    await web.api.updateProduct(
      web.token,
      webProductId,
      toUpdateProductPayload(fields({ ...productToFormValues(stale), minimumStock: '3' }), stale.version),
    );
    // ...so Mobile's save with the old version must not overwrite it silently.
    const conflict = await mobile.api
      .updateProduct(mobile.token, webProductId, toUpdateProductPayload(fields({ ...productToFormValues(stale), name: 'Pisaría el cambio' }), stale.version))
      .catch((err: unknown) => err);
    expect(conflict).toBeInstanceOf(ClientHttpError);
    expect((conflict as ClientHttpError).status).toBe(409);
    expect(isVersionConflict(conflict)).toBe(true);

    const fresh = await mobile.api.getProduct(mobile.token, webProductId);
    await mobile.api.updateProduct(
      mobile.token,
      webProductId,
      toUpdateProductPayload(fields({ ...productToFormValues(fresh), name: 'Hilo editado en Mobile' }), fresh.version),
    );

    const seenByWeb = await web.api.getProduct(web.token, webProductId);
    expect(seenByWeb.name).toBe('Hilo editado en Mobile');
    expect(seenByWeb.minimumStock).toBe(3);
  });

  it('clearing optional fields from one client is visible to the other', async () => {
    const category = await request(app)
      .post('/api/v1/inventory/categories')
      .set('Authorization', `Bearer ${web.token}`)
      .send({ name: `Hilos ${stamp}` });
    expect(category.status).toBe(201);

    const current = await web.api.getProduct(web.token, webProductId);
    const withExtras = await web.api.updateProduct(
      web.token,
      webProductId,
      toUpdateProductPayload(
        fields({ ...productToFormValues(current), description: 'Con descripción', categoryId: category.body.data._id, barcode: `75${stamp}`, maximumStock: '90' }),
        current.version,
      ),
    );
    expect(withExtras.categoryId).toBe(category.body.data._id);

    const cleared = await mobile.api.updateProduct(
      mobile.token,
      webProductId,
      toUpdateProductPayload(
        fields({ ...productToFormValues(withExtras), description: '', categoryId: '', barcode: '', maximumStock: '' }),
        withExtras.version,
      ),
    );
    expect(cleared.description).toBeUndefined();
    expect(cleared.categoryId).toBeUndefined();
    expect(cleared.barcode).toBeUndefined();
    expect(cleared.maximumStock).toBeUndefined();

    const seenByWeb = await web.api.getProduct(web.token, webProductId);
    expect(seenByWeb.description).toBeUndefined();
    expect(seenByWeb.categoryId).toBeUndefined();
  });

  it('prueba 5: Web deactivates (logical delete) and Mobile sees it; Mobile reactivates', async () => {
    const deactivated = await web.api.deactivateProduct(web.token, mobileProductId);
    expect(deactivated.status).toBe('INACTIVE');

    const seenByMobile = await mobile.api.getProduct(mobile.token, mobileProductId);
    expect(seenByMobile.status).toBe('INACTIVE');
    const activeOnly = await mobile.api.listProducts(mobile.token, { status: 'ACTIVE' });
    expect(activeOnly.map((p) => p._id)).not.toContain(mobileProductId);

    const reactivated = await mobile.api.activateProduct(mobile.token, mobileProductId, seenByMobile.version);
    expect(reactivated.status).toBe('ACTIVE');
    expect((await web.api.getProduct(web.token, mobileProductId)).status).toBe('ACTIVE');
  });

  it('another company never sees or changes this inventory (404, never 200)', async () => {
    const theirList = await otherTenant.api.listProducts(otherTenant.token);
    expect(theirList.map((p) => p._id)).not.toContain(webProductId);
    expect(theirList.map((p) => p._id)).not.toContain(mobileProductId);

    for (const attempt of [
      () => otherTenant.api.getProduct(otherTenant.token, webProductId),
      () => otherTenant.api.updateProduct(otherTenant.token, webProductId, toUpdateProductPayload(fields({ sku: 'X-1', name: 'Intruso' }), 0)),
      () => otherTenant.api.deactivateProduct(otherTenant.token, webProductId),
      () => otherTenant.api.activateProduct(otherTenant.token, webProductId, 0),
    ]) {
      const err = await attempt().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ClientHttpError);
      expect((err as ClientHttpError).status).toBe(404);
    }

    const intact = await web.api.getProduct(web.token, webProductId);
    expect(intact.name).toBe('Hilo editado en Mobile');
  });

  it('a user cannot pick another company: credentials only work in their own tenant', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ownerA, password: PASSWORD, tenantId: companyB.tenantId });
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('accessToken');
  });

  it('read-only users see the shared inventory but cannot write it from any client', async () => {
    const viewerRole = await deps.roles.create({
      tenantId: companyA.tenantId,
      name: `viewer-${stamp}`,
      permissions: ['inventory.read'],
      createdBy: 'test',
    });
    const viewerEmail = `viewer.${stamp}@example.mx`;
    const created = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${web.token}`)
      .send({ email: viewerEmail, username: `viewer.${stamp}`, password: PASSWORD, roleIds: [viewerRole._id] });
    expect(created.status).toBe(201);

    const viewer = await loginLikeApps('viewer', companyA.tenant.slug, viewerEmail);
    expect((await viewer.api.listProducts(viewer.token)).map((p) => p._id)).toContain(webProductId);

    const product = await viewer.api.getProduct(viewer.token, webProductId);
    for (const attempt of [
      () => viewer.api.createProduct(viewer.token, toCreateProductPayload(fields({ sku: `ro-${stamp}`, name: 'No permitido' }))),
      () => viewer.api.updateProduct(viewer.token, webProductId, toUpdateProductPayload(fields(productToFormValues(product)), product.version)),
      () => viewer.api.deactivateProduct(viewer.token, webProductId),
    ]) {
      const err = await attempt().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ClientHttpError);
      expect((err as ClientHttpError).status).toBe(403);
    }
  });
});

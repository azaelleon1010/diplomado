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
import { AuditEventModel } from '../../apps/api/src/modules/identity/infrastructure/models';
import { StockMovementModel } from '../../apps/api/src/modules/inventory/infrastructure/stockModels';

let mongod: MongoMemoryReplSet | undefined;
let app: Express;
let deps: RegisterDeps;
const stamp = Date.now().toString(36);
let seq = 0;
const key = () => `test-${stamp}-${++seq}`;

describe('Inventory ledger: movements, balances, idempotency, concurrency', () => {
  let tenantId = '';
  let slug = '';
  let token = '';
  let otherToken = '';
  let warehouseA = '';
  let warehouseB = '';
  let inactiveWarehouse = '';
  let product = '';
  let untracked = '';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const post = (path: string, body: object, t = token) => request(app).post(`/api/v1/inventory${path}`).set(auth(t)).send(body);
  const get = (path: string, t = token) => request(app).get(`/api/v1/inventory${path}`).set(auth(t));
  const balance = async (productId: string, warehouseId: string) => {
    const res = await get(`/stock?productId=${productId}&warehouseId=${warehouseId}`);
    return (res.body.data[0]?.quantity as number | undefined) ?? 0;
  };

  async function register(companyName: string, email: string) {
    const res = await request(app).post('/api/v1/auth/register').send({ companyName, username: `u.${stamp}.${companyName.length}`, email, password: 'Password123' });
    expect(res.status).toBe(201);
    return res.body.data as { accessToken: string; tenantId: string; tenant: { slug: string } };
  }

  async function userWith(permissions: string[], name: string) {
    const role = await deps.roles.create({ tenantId, name: `${name}-${stamp}`, permissions, createdBy: 'test' });
    const email = `${name}.${stamp}@x.mx`;
    const created = await request(app).post('/api/v1/users').set(auth(token)).send({ email, username: `${name}.${stamp}`, password: 'Password123', roleIds: [role._id] });
    expect(created.status).toBe(201);
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123', tenantId });
    return login.body.data.accessToken as string;
  }

  beforeAll(async () => {
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      process.env.MONGODB_URI = mongod.getUri();
    }
    process.env.MONGODB_DATABASE = 'test_inventory_ledger';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'integration-test-secret-32-chars-min!!';
    process.env.BCRYPT_ROUNDS = '4';
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    __resetConfigForTests();
    await disconnectMongo().catch(() => {});
    await connectMongo();
    await ensureIndexes(applicationModels);
    deps = buildIdentityDeps({ async sendWelcomeEmail() {} });
    app = createApp(deps);

    const company = await register(`Ledger ${stamp}`, `owner.${stamp}@x.mx`);
    tenantId = company.tenantId;
    slug = company.tenant.slug;
    token = company.accessToken;
    otherToken = (await register(`Otra ${stamp}`, `other.${stamp}@x.mx`)).accessToken;

    warehouseA = (await post('/warehouses', { code: 'ALM-A', name: 'Almacén A' })).body.data._id;
    warehouseB = (await post('/warehouses', { code: 'ALM-B', name: 'Almacén B' })).body.data._id;
    inactiveWarehouse = (await post('/warehouses', { code: 'ALM-X', name: 'Cerrado' })).body.data._id;
    await request(app).delete(`/api/v1/inventory/warehouses/${inactiveWarehouse}`).set(auth(token));
    product = (await post('/products', { sku: `HILO-${stamp}`, name: 'Hilo', unit: 'KG', cost: 10, price: 20 })).body.data._id;
    untracked = (await post('/products', { sku: `SERV-${stamp}`, name: 'Servicio', unit: 'PZA', cost: 0, price: 5, trackInventory: false })).body.data._id;
    expect(slug).toBeTruthy();
  }, 90000);

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('a receipt creates an immutable movement and the balance', async () => {
    const res = await post('/movements', { lines: [{ productId: product, warehouseId: warehouseA, type: 'RECEIPT', quantity: 100, unitCost: 10 }], reference: 'INI-001', idempotencyKey: key() });
    expect(res.status).toBe(201);
    expect(res.body.data.movements[0]).toMatchObject({ type: 'RECEIPT', direction: 'IN', quantity: 100, balanceAfter: 100, source: { type: 'MANUAL', reference: 'INI-001' } });
    expect(await balance(product, warehouseA)).toBe(100);
  });

  it('retries with the same key do not duplicate; a different payload is rejected', async () => {
    const k = key();
    const body = { lines: [{ productId: product, warehouseId: warehouseA, type: 'ADJUSTMENT_IN', quantity: 5 }], idempotencyKey: k };
    const first = await post('/movements', body);
    const retry = await post('/movements', body);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.replayed).toBe(true);
    expect(retry.body.data.postingId).toBe(first.body.data.postingId);
    expect(await balance(product, warehouseA)).toBe(105);

    const reused = await post('/movements', { ...body, lines: [{ ...body.lines[0], quantity: 6 }] });
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await balance(product, warehouseA)).toBe(105);
  });

  it('never goes negative and a failing line rolls back the whole posting', async () => {
    const res = await post('/movements', { lines: [{ productId: product, warehouseId: warehouseA, type: 'ISSUE', quantity: 500 }], idempotencyKey: key() });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'INSUFFICIENT_STOCK', fields: { available: 105, requested: 500 } });

    const atomic = await post('/movements', {
      lines: [
        { productId: product, warehouseId: warehouseB, type: 'RECEIPT', quantity: 10 },
        { productId: product, warehouseId: warehouseA, type: 'ISSUE', quantity: 999 },
      ],
      idempotencyKey: key(),
    });
    expect(atomic.status).toBe(409);
    expect(await balance(product, warehouseB)).toBe(0);
    expect(await balance(product, warehouseA)).toBe(105);
  });

  it('keeps decimal quantities exact (3 decimals)', async () => {
    await post('/movements', { lines: [{ productId: product, warehouseId: warehouseA, type: 'RECEIPT', quantity: 0.1 }], idempotencyKey: key() });
    await post('/movements', { lines: [{ productId: product, warehouseId: warehouseA, type: 'RECEIPT', quantity: 0.2 }], idempotencyKey: key() });
    expect(await balance(product, warehouseA)).toBe(105.3);
    const bad = await post('/movements', { lines: [{ productId: product, warehouseId: warehouseA, type: 'RECEIPT', quantity: 0.0001 }], idempotencyKey: key() });
    expect(bad.status).toBe(400);
  });

  it('transfers atomically between warehouses', async () => {
    const res = await post('/transfers', { productId: product, fromWarehouseId: warehouseA, toWarehouseId: warehouseB, quantity: 30.3, idempotencyKey: key() });
    expect(res.status).toBe(201);
    const [out, inn] = res.body.data.movements;
    expect(out).toMatchObject({ type: 'TRANSFER_OUT', warehouseId: warehouseA, balanceAfter: 75 });
    expect(inn).toMatchObject({ type: 'TRANSFER_IN', warehouseId: warehouseB, balanceAfter: 30.3 });
    expect(out.postingId).toBe(inn.postingId);

    const same = await post('/transfers', { productId: product, fromWarehouseId: warehouseA, toWarehouseId: warehouseA, quantity: 1, idempotencyKey: key() });
    expect(same.status).toBe(400);
    const viaMovements = await post('/movements', { lines: [{ productId: product, warehouseId: warehouseA, type: 'TRANSFER_OUT', quantity: 1 }], idempotencyKey: key() });
    expect(viaMovements.status).toBe(400);
  });

  it('concurrent issues cannot overdraw stock', async () => {
    // warehouseA has 75: five parallel issues of 20 → at most 3 may succeed.
    const results = await Promise.all(
      Array.from({ length: 5 }, () => post('/movements', { lines: [{ productId: product, warehouseId: warehouseA, type: 'ISSUE', quantity: 20 }], idempotencyKey: key() })),
    );
    const ok = results.filter((r) => r.status === 201).length;
    // Write conflicts are retried by the transaction, so exactly 3 fit.
    expect(ok).toBe(3);
    expect(results.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    const final = await balance(product, warehouseA);
    expect(final).toBe(75 - 20 * ok);
    expect(final).toBeGreaterThanOrEqual(0);
  });

  it('balance equals the signed sum of its movements (ledger invariant)', async () => {
    for (const warehouseId of [warehouseA, warehouseB]) {
      const docs = await StockMovementModel.find({ tenantId, productId: product, warehouseId }).lean().exec();
      const sum = docs.reduce((acc, m) => acc + (m.direction === 'IN' ? m.quantity : -m.quantity), 0);
      expect(Math.round(sum * 1000) / 1000).toBe(await balance(product, warehouseId));
    }
    const list = await get(`/movements?productId=${product}&warehouseId=${warehouseB}`);
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBe(1);
  });

  it('rejects untracked products and inactive warehouses', async () => {
    const untrackedRes = await post('/movements', { lines: [{ productId: untracked, warehouseId: warehouseA, type: 'RECEIPT', quantity: 1 }], idempotencyKey: key() });
    expect(untrackedRes.status).toBe(400);
    const closed = await post('/movements', { lines: [{ productId: product, warehouseId: inactiveWarehouse, type: 'RECEIPT', quantity: 1 }], idempotencyKey: key() });
    expect(closed.status).toBe(400);
  });

  it('enforces the permission of each movement type', async () => {
    const viewer = await userWith(['inventory.read'], 'viewer');
    expect((await post('/movements', { lines: [{ productId: product, warehouseId: warehouseA, type: 'RECEIPT', quantity: 1 }], idempotencyKey: key() }, viewer)).status).toBe(403);
    expect((await get('/stock', viewer)).status).toBe(200);

    const receiver = await userWith(['inventory.read', 'inventory.stock.in'], 'receiver');
    expect((await post('/movements', { lines: [{ productId: product, warehouseId: warehouseB, type: 'RECEIPT', quantity: 1 }], idempotencyKey: key() }, receiver)).status).toBe(201);
    expect((await post('/movements', { lines: [{ productId: product, warehouseId: warehouseB, type: 'ADJUSTMENT_OUT', quantity: 1 }], idempotencyKey: key() }, receiver)).status).toBe(403);
    expect((await post('/transfers', { productId: product, fromWarehouseId: warehouseB, toWarehouseId: warehouseA, quantity: 1, idempotencyKey: key() }, receiver)).status).toBe(403);
  });

  it('isolates tenants (404/empty, never another company stock)', async () => {
    const res = await post('/movements', { lines: [{ productId: product, warehouseId: warehouseA, type: 'RECEIPT', quantity: 1 }], idempotencyKey: key() }, otherToken);
    expect(res.status).toBe(404);
    const theirStock = await get(`/stock?productId=${product}`, otherToken);
    expect(theirStock.body.data).toEqual([]);
    const theirMoves = await get(`/movements?productId=${product}`, otherToken);
    expect(theirMoves.body.meta.total).toBe(0);
  });

  it('audits every posting', async () => {
    const count = await AuditEventModel.countDocuments({ tenantId, action: 'inventory.stock.posted' }).exec();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});

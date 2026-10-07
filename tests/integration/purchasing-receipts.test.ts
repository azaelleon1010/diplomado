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

let mongod: MongoMemoryReplSet | undefined;
let app: Express;
let deps: RegisterDeps;
const stamp = Date.now().toString(36);
let seq = 0;
const key = () => `rcpt-${stamp}-${++seq}`;

describe('Purchasing → Inventory: goods receipts', () => {
  let tenantId = '';
  let owner = '';
  let other = '';
  let warehouse = '';
  let fabric = '';
  let service = '';
  let supplier = '';

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const api = (method: 'get' | 'post' | 'delete', path: string, t = owner) => request(app)[method](`/api/v1${path}`).set(auth(t));

  async function register(companyName: string, email: string) {
    const res = await request(app).post('/api/v1/auth/register').send({ companyName, username: `u.${stamp}.${companyName.length}`, email, password: 'Password123' });
    expect(res.status).toBe(201);
    return res.body.data as { accessToken: string; tenantId: string };
  }

  async function userWith(permissions: string[], name: string) {
    const role = await deps.roles.create({ tenantId, name: `${name}-${stamp}`, permissions, createdBy: 'test' });
    const email = `${name}.${stamp}@x.mx`;
    expect((await api('post', '/users').send({ email, username: `${name}.${stamp}`, password: 'Password123', roleIds: [role._id] })).status).toBe(201);
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123', tenantId });
    return login.body.data.accessToken as string;
  }

  /** Creates an order and moves it to APPROVED. */
  async function approvedOrder(folio: string, lines: Array<{ productId: string; quantity: number; unitCost: number }>) {
    const created = await api('post', '/purchasing/orders').send({ folio, supplierId: supplier, lines });
    expect(created.status).toBe(201);
    const sent = await api('post', `/purchasing/orders/${created.body.data._id}/transition`).send({ to: 'SENT', expectedVersion: created.body.data.version });
    const approved = await api('post', `/purchasing/orders/${created.body.data._id}/transition`).send({ to: 'APPROVED', expectedVersion: sent.body.data.version });
    expect(approved.status).toBe(200);
    return approved.body.data as { _id: string; version: number; folio: string };
  }

  const receive = (orderId: string, lines: Array<{ productId: string; quantity: number }>, idempotencyKey = key(), t = owner) =>
    api('post', `/purchasing/orders/${orderId}/receipts`, t).send({ warehouseId: warehouse, lines, idempotencyKey });

  const stockOf = async (productId: string) => {
    const res = await api('get', `/inventory/stock?productId=${productId}&warehouseId=${warehouse}`);
    return (res.body.data[0]?.quantity as number | undefined) ?? 0;
  };

  beforeAll(async () => {
    if (process.env.TEST_MONGO_URI) {
      process.env.MONGODB_URI = process.env.TEST_MONGO_URI;
    } else {
      mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
      process.env.MONGODB_URI = mongod.getUri();
    }
    process.env.MONGODB_DATABASE = 'test_purchasing_receipts';
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

    const company = await register(`Compras ${stamp}`, `owner.${stamp}@x.mx`);
    tenantId = company.tenantId;
    owner = company.accessToken;
    other = (await register(`Ajena ${stamp}`, `other.${stamp}@x.mx`)).accessToken;

    warehouse = (await api('post', '/inventory/warehouses').send({ code: 'REC', name: 'Recepción' })).body.data._id;
    fabric = (await api('post', '/inventory/products').send({ sku: `TEL-${stamp}`, name: 'Tela', unit: 'MT', cost: 40, price: 70 })).body.data._id;
    service = (await api('post', '/inventory/products').send({ sku: `FLE-${stamp}`, name: 'Flete', unit: 'SERV', cost: 500, price: 0, trackInventory: false })).body.data._id;
    supplier = (await api('post', '/purchasing/suppliers').send({ code: `PRV-${stamp}`, name: 'Proveedor Textil' })).body.data._id;
  }, 90000);

  afterAll(async () => {
    await disconnectMongo().catch(() => {});
    if (mongod) await mongod.stop();
    __resetConfigForTests();
  });

  it('a partial receipt posts stock at the order cost and links the ledger', async () => {
    const order = await approvedOrder(`OC-A-${stamp}`, [
      { productId: fabric, quantity: 100, unitCost: 38.5 },
      { productId: service, quantity: 1, unitCost: 500 },
    ]);
    const res = await receive(order._id, [{ productId: fabric, quantity: 60 }, { productId: service, quantity: 1 }]);
    expect(res.status).toBe(201);
    const { receipt, order: updated } = res.body.data;
    expect(updated.status).toBe('PARTIALLY_RECEIVED');
    expect(receipt).toMatchObject({ purchaseOrderFolio: `OC-A-${stamp}`.toUpperCase(), warehouseId: warehouse, status: 'POSTED', total: 60 * 38.5 + 500 });
    expect(receipt.lines.find((l: { productId: string }) => l.productId === service)).toMatchObject({ stocked: false });
    expect(await stockOf(fabric)).toBe(60);
    expect(await stockOf(service)).toBe(0);

    const movements = await api('get', `/inventory/movements?sourceType=PURCHASE_RECEIPT&sourceId=${receipt._id}`);
    expect(movements.body.data).toHaveLength(1);
    expect(movements.body.data[0]).toMatchObject({ type: 'RECEIPT', quantity: 60, unitCost: 38.5, postingId: receipt.postingId });

    const listed = await api('get', `/purchasing/receipts?purchaseOrderId=${order._id}`);
    expect(listed.body.data.map((r: { _id: string }) => r._id)).toEqual([receipt._id]);
    expect((await api('get', `/purchasing/receipts/${receipt._id}`)).body.data.folio).toBe(receipt.folio);

    const rest = await receive(order._id, [{ productId: fabric, quantity: 40 }]);
    expect(rest.body.data.order.status).toBe('RECEIVED');
    expect(await stockOf(fabric)).toBe(100);
    expect(rest.body.data.receipt.folio).not.toBe(receipt.folio);
  });

  it('retries are idempotent and over-receiving is rejected without side effects', async () => {
    const order = await approvedOrder(`OC-B-${stamp}`, [{ productId: fabric, quantity: 10, unitCost: 40 }]);
    const before = await stockOf(fabric);
    const k = key();
    const first = await receive(order._id, [{ productId: fabric, quantity: 4 }], k);
    const retry = await receive(order._id, [{ productId: fabric, quantity: 4 }], k);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.data.replayed).toBe(true);
    expect(retry.body.data.receipt._id).toBe(first.body.data.receipt._id);
    expect(await stockOf(fabric)).toBe(before + 4);

    const reused = await receive(order._id, [{ productId: fabric, quantity: 5 }], k);
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_CONFLICT');

    const over = await receive(order._id, [{ productId: fabric, quantity: 7 }]);
    expect(over.status).toBe(400);
    expect(over.body.error.fields).toMatchObject({ pending: 6, requested: 7 });
    const foreign = await receive(order._id, [{ productId: service, quantity: 1 }]);
    expect(foreign.status).toBe(400);
    expect(await stockOf(fabric)).toBe(before + 4);
  });

  it('concurrent receipts cannot exceed the ordered quantity', async () => {
    const order = await approvedOrder(`OC-C-${stamp}`, [{ productId: fabric, quantity: 10, unitCost: 40 }]);
    const before = await stockOf(fabric);
    const results = await Promise.all(Array.from({ length: 4 }, () => receive(order._id, [{ productId: fabric, quantity: 6 }])));
    const ok = results.filter((r) => r.status === 201);
    expect(ok).toHaveLength(1);
    expect(results.every((r) => [201, 400, 409].includes(r.status))).toBe(true);
    expect(await stockOf(fabric)).toBe(before + 6);
    const final = await api('get', `/purchasing/orders/${order._id}`);
    expect(final.body.data.lines[0].quantityReceived).toBe(6);
  });

  it('only approved or partially received orders can be received', async () => {
    const draft = await api('post', '/purchasing/orders').send({ folio: `OC-D-${stamp}`, supplierId: supplier, lines: [{ productId: fabric, quantity: 1, unitCost: 1 }] });
    expect((await receive(draft.body.data._id, [{ productId: fabric, quantity: 1 }])).status).toBe(400);

    const order = await approvedOrder(`OC-E-${stamp}`, [{ productId: fabric, quantity: 5, unitCost: 1 }]);
    expect((await api('delete', `/purchasing/orders/${order._id}`)).body.data.status).toBe('CANCELLED');
    expect((await receive(order._id, [{ productId: fabric, quantity: 1 }])).status).toBe(400);
  });

  it('separates create, approve, receive and cancel permissions', async () => {
    const buyer = await userWith(['purchasing.read', 'purchasing.create', 'purchasing.update', 'inventory.read'], 'buyer');
    const receiver = await userWith(['purchasing.read', 'purchasing.receive', 'inventory.read'], 'receiver');

    const created = await api('post', '/purchasing/orders', buyer).send({ folio: `OC-F-${stamp}`, supplierId: supplier, lines: [{ productId: fabric, quantity: 3, unitCost: 10 }] });
    const sent = await api('post', `/purchasing/orders/${created.body.data._id}/transition`, buyer).send({ to: 'SENT', expectedVersion: created.body.data.version });
    expect(sent.status).toBe(200);
    expect((await api('post', `/purchasing/orders/${created.body.data._id}/transition`, buyer).send({ to: 'APPROVED', expectedVersion: sent.body.data.version })).status).toBe(403);
    expect((await api('delete', `/purchasing/orders/${created.body.data._id}`, buyer)).status).toBe(403);

    const approved = await api('post', `/purchasing/orders/${created.body.data._id}/transition`).send({ to: 'APPROVED', expectedVersion: sent.body.data.version });
    expect(approved.status).toBe(200);
    expect(approved.body.data.approvedBy).toBeTruthy();
    expect(approved.body.data.approvedAt).toBeTruthy();

    expect((await receive(created.body.data._id, [{ productId: fabric, quantity: 1 }], key(), buyer)).status).toBe(403);
    expect((await receive(created.body.data._id, [{ productId: fabric, quantity: 3 }], key(), receiver)).status).toBe(201);
    expect((await api('post', `/purchasing/orders/${created.body.data._id}/transition`, receiver).send({ to: 'APPROVED', expectedVersion: 0 })).status).toBe(403);
  });

  it('isolates tenants and audits receipts', async () => {
    const order = await approvedOrder(`OC-G-${stamp}`, [{ productId: fabric, quantity: 2, unitCost: 1 }]);
    const res = await api('post', `/purchasing/orders/${order._id}/receipts`, other).send({ warehouseId: warehouse, lines: [{ productId: fabric, quantity: 1 }], idempotencyKey: key() });
    expect(res.status).toBe(404);
    expect((await api('get', '/purchasing/receipts', other)).body.data).toEqual([]);

    const audits = await AuditEventModel.countDocuments({ tenantId, action: 'purchasing.receipt.posted' }).exec();
    expect(audits).toBeGreaterThanOrEqual(5);
  });
});

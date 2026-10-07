import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { client, registerCompany, startHarness, userWith, type Harness } from '../helpers/integration';

describe('Supplier quotes: register, compare, award', () => {
  let h: Harness;
  let owner: ReturnType<typeof client>;
  let buyer: ReturnType<typeof client>;
  let other: ReturnType<typeof client>;
  let fabric = '';
  let thread = '';
  const suppliers: string[] = [];

  beforeAll(async () => {
    h = await startHarness('test_purchasing_quotes');
    const company = await registerCompany(h, 'Cotizaciones');
    owner = client(h, company.token);
    buyer = client(h, await userWith(h, company, ['purchasing.read', 'purchasing.create', 'inventory.read'], 'buyer'));
    other = client(h, (await registerCompany(h, 'Ajena')).token);
    fabric = (await owner.post('/inventory/products', { sku: `TEL-${h.stamp}`, name: 'Tela', unit: 'MT', cost: 40, price: 70 })).body.data._id;
    thread = (await owner.post('/inventory/products', { sku: `HIL-${h.stamp}`, name: 'Hilo', unit: 'KG', cost: 90, price: 120 })).body.data._id;
    for (const [code, currency] of [['A', 'MXN'], ['B', 'MXN'], ['C', 'USD']]) {
      suppliers.push((await owner.post('/purchasing/suppliers', { code: `${code}-${h.stamp}`, name: `Proveedor ${code}`, currency })).body.data._id);
    }
  }, 90000);

  afterAll(async () => h.stop());

  async function request(status: 'SUBMITTED' | 'APPROVED') {
    const created = await buyer.post('/purchasing/requests', { lines: [{ productId: fabric, quantity: 100 }, { productId: thread, quantity: 10 }] });
    const submitted = await buyer.post(`/purchasing/requests/${created.body.data._id}/submit`, { expectedVersion: created.body.data.version });
    if (status === 'SUBMITTED') return submitted.body.data;
    return (await owner.post(`/purchasing/requests/${created.body.data._id}/decision`, { decision: 'APPROVED', expectedVersion: submitted.body.data.version })).body.data;
  }

  it('compares quotes per line and awards the winner into a purchase order', async () => {
    const req = await request('SUBMITTED');
    const qa = await buyer.post(`/purchasing/requests/${req._id}/quotes`, { supplierId: suppliers[0], lines: [{ productId: fabric, unitCost: 40 }, { productId: thread, unitCost: 80, leadTimeDays: 5 }] });
    const qb = await buyer.post(`/purchasing/requests/${req._id}/quotes`, { supplierId: suppliers[1], lines: [{ productId: fabric, unitCost: 37 }, { productId: thread, unitCost: 95 }] });
    const qc = await buyer.post(`/purchasing/requests/${req._id}/quotes`, { supplierId: suppliers[2], lines: [{ productId: fabric, unitCost: 30 }] });
    expect([qa.status, qb.status, qc.status]).toEqual([201, 201, 201]);
    expect(qa.body.data.folio).toMatch(/^COT-\d{6}$/);
    expect(qa.body.data.total).toBe(100 * 40 + 10 * 80);
    expect(qc.body.data.currency).toBe('USD');

    const dup = await buyer.post(`/purchasing/requests/${req._id}/quotes`, { supplierId: suppliers[0], lines: [{ productId: fabric, unitCost: 1 }] });
    expect(dup.status).toBe(409);

    const cmp = await buyer.get(`/purchasing/requests/${req._id}/quotes`);
    expect(cmp.status).toBe(200);
    const byProduct = Object.fromEntries(cmp.body.data.lines.map((l: { productId: string; bestQuoteId: string; offers: unknown[] }) => [l.productId, l]));
    expect(byProduct[fabric].bestQuoteId).toBe(qc.body.data._id);
    expect(byProduct[thread].bestQuoteId).toBe(qa.body.data._id);
    expect(byProduct[fabric].offers).toHaveLength(3);
    // C is cheapest but incomplete; B (100*37 + 10*95 = 4650) beats A (4800).
    expect(cmp.body.data.bestCompleteQuoteId).toBe(qb.body.data._id);

    // Awarding needs an approved request and a complete quote.
    expect((await owner.post(`/purchasing/quotes/${qb.body.data._id}/award`, { expectedVersion: qb.body.data.version })).status).toBe(400);
    const approved = await owner.post(`/purchasing/requests/${req._id}/decision`, { decision: 'APPROVED', expectedVersion: req.version });
    expect(approved.status).toBe(200);
    expect((await owner.post(`/purchasing/quotes/${qc.body.data._id}/award`, { expectedVersion: qc.body.data.version })).status).toBe(400);
    expect((await buyer.post(`/purchasing/quotes/${qb.body.data._id}/award`, { expectedVersion: qb.body.data.version })).status).toBe(403);

    const awarded = await owner.post(`/purchasing/quotes/${qb.body.data._id}/award`, { expectedVersion: qb.body.data.version });
    expect(awarded.status).toBe(201);
    const { quote, order, request: ordered } = awarded.body.data;
    expect(quote).toMatchObject({ status: 'AWARDED', purchaseOrderId: order._id });
    expect(order).toMatchObject({ supplierId: suppliers[1], requestId: req._id, status: 'DRAFT', subtotal: 4650 });
    expect(ordered.status).toBe('ORDERED');

    const after = await buyer.get(`/purchasing/requests/${req._id}/quotes`);
    const statuses = Object.fromEntries(after.body.data.quotes.map((q: { _id: string; status: string }) => [q._id, q.status]));
    expect(statuses).toEqual({ [qa.body.data._id]: 'DISCARDED', [qb.body.data._id]: 'AWARDED', [qc.body.data._id]: 'DISCARDED' });

    expect((await owner.post(`/purchasing/quotes/${qa.body.data._id}/award`, { expectedVersion: 0 })).status).toBe(400);
  });

  it('rejects quotes for products outside the request and for closed requests', async () => {
    const req = await request('APPROVED');
    const otherProduct = (await owner.post('/inventory/products', { sku: `BOT-${h.stamp}`, name: 'Botón', unit: 'PZA', cost: 1, price: 2 })).body.data._id;
    expect((await buyer.post(`/purchasing/requests/${req._id}/quotes`, { supplierId: suppliers[0], lines: [{ productId: otherProduct, unitCost: 1 }] })).status).toBe(400);

    const draft = await buyer.post('/purchasing/requests', { lines: [{ productId: fabric, quantity: 1 }] });
    expect((await buyer.post(`/purchasing/requests/${draft.body.data._id}/quotes`, { supplierId: suppliers[0], lines: [{ productId: fabric, unitCost: 1 }] })).status).toBe(400);
  });

  it('isolates tenants', async () => {
    const req = await request('APPROVED');
    const quote = await buyer.post(`/purchasing/requests/${req._id}/quotes`, { supplierId: suppliers[0], lines: [{ productId: fabric, unitCost: 1 }, { productId: thread, unitCost: 1 }] });
    expect((await other.get(`/purchasing/requests/${req._id}/quotes`)).status).toBe(404);
    expect((await other.post(`/purchasing/quotes/${quote.body.data._id}/award`, { expectedVersion: quote.body.data.version })).status).toBe(404);
  });
});

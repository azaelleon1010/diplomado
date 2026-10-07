import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { client, registerCompany, startHarness, userWith, type Harness } from '../helpers/integration';

describe('Supplier invoices: three-way match and accounts payable', () => {
  let h: Harness;
  let owner: ReturnType<typeof client>;
  let buyer: ReturnType<typeof client>;
  let apClerk: ReturnType<typeof client>;
  let other: ReturnType<typeof client>;
  let product = '';
  let supplier = '';
  let warehouse = '';
  let seq = 0;
  const key = () => `inv-${h.stamp}-${++seq}`;
  const today = new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    h = await startHarness('test_purchasing_invoices');
    const company = await registerCompany(h, 'CxP');
    owner = client(h, company.token);
    other = client(h, (await registerCompany(h, 'Ajena')).token);
    buyer = client(h, await userWith(h, company, ['purchasing.read', 'purchasing.create'], 'buyer'));
    apClerk = client(h, await userWith(h, company, ['finance.read', 'finance.create'], 'apclerk'));
    product = (await owner.post('/inventory/products', { sku: `HIL-${h.stamp}`, name: 'Hilo', unit: 'KG', cost: 100, price: 150 })).body.data._id;
    supplier = (await owner.post('/purchasing/suppliers', { code: `PRV-${h.stamp}`, name: 'Proveedor', paymentTermsDays: 30 })).body.data._id;
    warehouse = (await owner.post('/inventory/warehouses', { code: `ALM-${h.stamp}`, name: 'Principal' })).body.data._id;
  }, 90000);

  afterAll(async () => h.stop());

  async function receivedOrder(folio: string, ordered: number, received: number, unitCost = 100) {
    const created = await owner.post('/purchasing/orders', { folio, supplierId: supplier, lines: [{ productId: product, quantity: ordered, unitCost }] });
    const sent = await owner.post(`/purchasing/orders/${created.body.data._id}/transition`, { to: 'SENT', expectedVersion: created.body.data.version });
    await owner.post(`/purchasing/orders/${created.body.data._id}/transition`, { to: 'APPROVED', expectedVersion: sent.body.data.version });
    const receipt = await owner.post(`/purchasing/orders/${created.body.data._id}/receipts`, { warehouseId: warehouse, lines: [{ productId: product, quantity: received }], idempotencyKey: key() });
    expect(receipt.status).toBe(201);
    return created.body.data._id as string;
  }

  const invoice = (api: ReturnType<typeof client>, orderId: string, number: string, quantity: number, unitCost: number, extra: object = {}, idempotencyKey = key()) =>
    api.post('/purchasing/invoices', { purchaseOrderId: orderId, supplierInvoiceNumber: number, invoiceDate: today, lines: [{ productId: product, quantity, unitCost }], idempotencyKey, ...extra });

  it('bills only received goods, computes taxes and due date, and is idempotent', async () => {
    const orderId = await receivedOrder(`OC-A-${h.stamp}`, 10, 6);
    const over = await invoice(owner, orderId, `A-${h.stamp}-1`, 7, 100);
    expect(over.status).toBe(400);
    expect(over.body.error.fields).toMatchObject({ billable: 6, requested: 7 });

    const k = key();
    const posted = await invoice(owner, orderId, `a-${h.stamp}-1`, 6, 100, { taxRate: 0.16 }, k);
    expect(posted.status).toBe(201);
    expect(posted.body.data.invoice).toMatchObject({
      status: 'POSTED',
      supplierInvoiceNumber: `A-${h.stamp}-1`.toUpperCase(),
      subtotal: 600,
      taxAmount: 96,
      total: 696,
      balance: 696,
      currency: 'MXN',
      matchIssues: [],
    });
    expect(posted.body.data.invoice.folio).toMatch(/^FAP-\d{6}$/);
    const due = new Date(`${today}T00:00:00Z`);
    due.setUTCDate(due.getUTCDate() + 30);
    expect(posted.body.data.invoice.dueDate).toBe(due.toISOString().slice(0, 10));

    const retry = await invoice(owner, orderId, `a-${h.stamp}-1`, 6, 100, { taxRate: 0.16 }, k);
    expect(retry.status).toBe(200);
    expect(retry.body.data.replayed).toBe(true);
    expect((await invoice(owner, orderId, `A-${h.stamp}-1`, 1, 100)).status).toBe(409);

    const order = await owner.get(`/purchasing/orders/${orderId}`);
    expect(order.body.data.lines[0]).toMatchObject({ quantityReceived: 6, quantityInvoiced: 6 });
    // Nothing left to bill until more goods arrive.
    expect((await invoice(owner, orderId, `A-${h.stamp}-2`, 1, 100)).status).toBe(400);
  });

  it('holds invoices with price variance until finance approves them', async () => {
    const orderId = await receivedOrder(`OC-B-${h.stamp}`, 4, 4);
    const held = await invoice(apClerk, orderId, `B-${h.stamp}`, 4, 110);
    expect(held.status).toBe(201);
    expect(held.body.data.invoice.status).toBe('ON_HOLD');
    expect(held.body.data.invoice.matchIssues[0]).toMatchObject({ type: 'PRICE_VARIANCE', orderUnitCost: 100, invoiceUnitCost: 110, variancePct: 10 });

    const inv = held.body.data.invoice;
    expect((await apClerk.post(`/purchasing/invoices/${inv._id}/release`, { expectedVersion: inv.version })).status).toBe(403);
    const released = await owner.post(`/purchasing/invoices/${inv._id}/release`, { expectedVersion: inv.version });
    expect(released.status).toBe(200);
    expect(released.body.data).toMatchObject({ status: 'POSTED' });
    expect(released.body.data.releasedBy).toBeTruthy();

    // Within tolerance (0.5%) posts directly.
    const orderId2 = await receivedOrder(`OC-B2-${h.stamp}`, 1, 1);
    expect((await invoice(owner, orderId2, `B2-${h.stamp}`, 1, 100.4)).body.data.invoice.status).toBe('POSTED');
  });

  it('cancelling returns billed quantities so a corrected invoice can be registered', async () => {
    const orderId = await receivedOrder(`OC-C-${h.stamp}`, 5, 5);
    const wrong = await invoice(owner, orderId, `C-${h.stamp}-1`, 5, 100);
    const inv = wrong.body.data.invoice;
    expect((await owner.post(`/purchasing/invoices/${inv._id}/cancel`, { reason: '', expectedVersion: inv.version })).status).toBe(400);
    const cancelled = await owner.post(`/purchasing/invoices/${inv._id}/cancel`, { reason: 'Folio fiscal incorrecto', expectedVersion: inv.version });
    expect(cancelled.body.data).toMatchObject({ status: 'CANCELLED', balance: 0 });
    expect((await owner.get(`/purchasing/orders/${orderId}`)).body.data.lines[0].quantityInvoiced).toBe(0);
    expect((await invoice(owner, orderId, `C-${h.stamp}-2`, 5, 100)).status).toBe(201);
  });

  it('concurrent invoices cannot bill the same received goods twice', async () => {
    const orderId = await receivedOrder(`OC-D-${h.stamp}`, 3, 3);
    const results = await Promise.all([1, 2, 3].map((n) => invoice(owner, orderId, `D-${h.stamp}-${n}`, 3, 100)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await owner.get(`/purchasing/orders/${orderId}`)).body.data.lines[0].quantityInvoiced).toBe(3);
  });

  it('summarizes payables with aging by currency and supplier', async () => {
    const orderId = await receivedOrder(`OC-E-${h.stamp}`, 2, 2);
    const old = await owner.post('/purchasing/invoices', { purchaseOrderId: orderId, supplierInvoiceNumber: `E-${h.stamp}`, invoiceDate: '2025-01-02', lines: [{ productId: product, quantity: 2, unitCost: 100 }], idempotencyKey: key() });
    expect(old.status).toBe(201);
    const summary = await apClerk.get('/purchasing/payables');
    expect(summary.status).toBe(200);
    const mxn = summary.body.data.totals.find((t: { currency: string }) => t.currency === 'MXN');
    expect(mxn.buckets.d90_plus).toBe(200);
    expect(mxn.overdue).toBe(200);
    expect(mxn.buckets.current).toBeGreaterThan(0);
    expect(mxn.open).toBe(Math.round((mxn.buckets.current + mxn.overdue) * 100) / 100);
    expect(summary.body.data.bySupplier[0]).toMatchObject({ supplierId: supplier, currency: 'MXN' });

    const open = await apClerk.get(`/purchasing/invoices?open=true&supplierId=${supplier}&limit=100`);
    expect(open.body.data.every((i: { status: string }) => ['POSTED', 'PARTIALLY_PAID'].includes(i.status))).toBe(true);
  });

  it('separates purchasing and finance permissions and isolates tenants', async () => {
    const orderId = await receivedOrder(`OC-F-${h.stamp}`, 1, 1);
    expect((await invoice(buyer, orderId, `F-${h.stamp}`, 1, 100)).status).toBe(403);
    expect((await buyer.get('/purchasing/invoices')).status).toBe(200);
    expect((await buyer.get('/purchasing/payables')).status).toBe(200);

    expect((await invoice(other, orderId, `F-${h.stamp}`, 1, 100)).status).toBe(404);
    expect((await other.get('/purchasing/invoices')).body.data).toEqual([]);
    expect((await other.get('/purchasing/payables')).body.data.totals).toEqual([]);
  });
});

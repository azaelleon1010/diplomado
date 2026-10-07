import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { client, registerCompany, startHarness, userWith, type Harness } from '../helpers/integration';

describe('Purchase requests: need → approval → purchase order', () => {
  let h: Harness;
  let owner: ReturnType<typeof client>;
  let requesterToken = '';
  let requester: ReturnType<typeof client>;
  let other: ReturnType<typeof client>;
  let fabric = '';
  let thread = '';
  let supplier = '';

  beforeAll(async () => {
    h = await startHarness('test_purchasing_requests');
    const company = await registerCompany(h, 'Solicitudes');
    owner = client(h, company.token);
    other = client(h, (await registerCompany(h, 'Ajena')).token);
    requesterToken = await userWith(h, company, ['purchasing.read', 'purchasing.create', 'inventory.read'], 'requester');
    requester = client(h, requesterToken);
    fabric = (await owner.post('/inventory/products', { sku: `TEL-${h.stamp}`, name: 'Tela', unit: 'MT', cost: 40, price: 70 })).body.data._id;
    thread = (await owner.post('/inventory/products', { sku: `HIL-${h.stamp}`, name: 'Hilo', unit: 'KG', cost: 90, price: 120 })).body.data._id;
    supplier = (await owner.post('/purchasing/suppliers', { code: `PRV-${h.stamp}`, name: 'Proveedor' })).body.data._id;
  }, 90000);

  afterAll(async () => h.stop());

  async function submitted(lines = [{ productId: fabric, quantity: 50 }, { productId: thread, quantity: 5 }]) {
    const created = await requester.post('/purchasing/requests', { department: 'Producción', justification: 'Orden de producción 88', lines });
    expect(created.status).toBe(201);
    const sent = await requester.post(`/purchasing/requests/${created.body.data._id}/submit`, { expectedVersion: created.body.data.version });
    expect(sent.status).toBe(200);
    return sent.body.data as { _id: string; version: number; folio: string };
  }

  it('runs the full flow up to stock: request → approve → order → approve → receipt', async () => {
    const req = await submitted();
    expect(req.folio).toMatch(/^SOL-\d{6}$/);

    const approved = await owner.post(`/purchasing/requests/${req._id}/decision`, { decision: 'APPROVED', expectedVersion: req.version });
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({ status: 'APPROVED' });
    expect(approved.body.data.decidedBy).toBeTruthy();

    const converted = await requester.post(`/purchasing/requests/${req._id}/convert`, {
      supplierId: supplier,
      lines: [{ productId: fabric, unitCost: 38 }, { productId: thread, unitCost: 88, quantity: 6 }],
      expectedVersion: approved.body.data.version,
    });
    expect(converted.status).toBe(201);
    const { order, request: ordered } = converted.body.data;
    expect(ordered).toMatchObject({ status: 'ORDERED', purchaseOrderId: order._id });
    expect(order).toMatchObject({ status: 'DRAFT', requestId: req._id, subtotal: 50 * 38 + 6 * 88 });
    expect(order.folio).toMatch(/^OC-\d{6}$/);

    const sent = await owner.post(`/purchasing/orders/${order._id}/transition`, { to: 'SENT', expectedVersion: order.version });
    const orderApproved = await owner.post(`/purchasing/orders/${order._id}/transition`, { to: 'APPROVED', expectedVersion: sent.body.data.version });
    expect(orderApproved.status).toBe(200);
    const warehouse = (await owner.post('/inventory/warehouses', { code: `ALM-${h.stamp}`, name: 'Principal' })).body.data._id;
    const receipt = await owner.post(`/purchasing/orders/${order._id}/receipts`, {
      warehouseId: warehouse,
      lines: [{ productId: fabric, quantity: 50 }, { productId: thread, quantity: 6 }],
      idempotencyKey: `req-flow-${h.stamp}`,
    });
    expect(receipt.status).toBe(201);
    expect(receipt.body.data.order.status).toBe('RECEIVED');
    const stock = await owner.get(`/inventory/stock?warehouseId=${warehouse}`);
    expect(Object.fromEntries(stock.body.data.map((b: { productId: string; quantity: number }) => [b.productId, b.quantity]))).toEqual({ [fabric]: 50, [thread]: 6 });

    // An ordered request cannot be converted again.
    const again = await requester.post(`/purchasing/requests/${req._id}/convert`, { supplierId: supplier, lines: [{ productId: fabric, unitCost: 1 }, { productId: thread, unitCost: 1 }], expectedVersion: ordered.version });
    expect(again.status).toBe(400);
  });

  it('enforces the lifecycle: edits only in draft, rejection needs a reason', async () => {
    const draft = await requester.post('/purchasing/requests', { lines: [{ productId: fabric, quantity: 1 }] });
    const edited = await requester.patch(`/purchasing/requests/${draft.body.data._id}`, { lines: [{ productId: fabric, quantity: 3 }], expectedVersion: draft.body.data.version });
    expect(edited.status).toBe(200);
    expect(edited.body.data.lines[0].quantity).toBe(3);
    // Draft cannot be approved before submission.
    expect((await owner.post(`/purchasing/requests/${draft.body.data._id}/decision`, { decision: 'APPROVED', expectedVersion: edited.body.data.version })).status).toBe(400);

    const req = await submitted([{ productId: fabric, quantity: 2 }]);
    expect((await requester.patch(`/purchasing/requests/${req._id}`, { justification: 'tarde', expectedVersion: req.version })).status).toBe(400);
    expect((await owner.post(`/purchasing/requests/${req._id}/decision`, { decision: 'REJECTED', expectedVersion: req.version })).status).toBe(400);
    const rejected = await owner.post(`/purchasing/requests/${req._id}/decision`, { decision: 'REJECTED', reason: 'Sin presupuesto', expectedVersion: req.version });
    expect(rejected.body.data).toMatchObject({ status: 'REJECTED', decisionReason: 'Sin presupuesto' });
    expect((await owner.post(`/purchasing/requests/${req._id}/cancel`)).status).toBe(400);

    const invalidLines = await requester.post('/purchasing/requests', { lines: [{ productId: fabric, quantity: 1 }, { productId: fabric, quantity: 2 }] });
    expect(invalidLines.status).toBe(400);
  });

  it('requires purchasing.approve to decide and prices for every line to convert', async () => {
    const req = await submitted([{ productId: fabric, quantity: 4 }, { productId: thread, quantity: 1 }]);
    expect((await requester.post(`/purchasing/requests/${req._id}/decision`, { decision: 'APPROVED', expectedVersion: req.version })).status).toBe(403);
    const approved = await owner.post(`/purchasing/requests/${req._id}/decision`, { decision: 'APPROVED', expectedVersion: req.version });

    const missingPrice = await requester.post(`/purchasing/requests/${req._id}/convert`, { supplierId: supplier, lines: [{ productId: fabric, unitCost: 1 }], expectedVersion: approved.body.data.version });
    expect(missingPrice.status).toBe(400);
    const foreignProduct = await requester.post(`/purchasing/requests/${req._id}/convert`, {
      supplierId: supplier,
      lines: [{ productId: fabric, unitCost: 1 }, { productId: thread, unitCost: 1 }, { productId: supplier, unitCost: 1 }],
      expectedVersion: approved.body.data.version,
    });
    expect(foreignProduct.status).toBe(400);

    const manualFolio = await requester.post(`/purchasing/requests/${req._id}/convert`, {
      supplierId: supplier,
      folio: `oc-man-${h.stamp}`,
      lines: [{ productId: fabric, unitCost: 1 }, { productId: thread, unitCost: 1 }],
      expectedVersion: approved.body.data.version,
    });
    expect(manualFolio.status).toBe(201);
    expect(manualFolio.body.data.order.folio).toBe(`OC-MAN-${h.stamp}`.toUpperCase());
  });

  it('concurrent conversions create a single purchase order', async () => {
    const req = await submitted([{ productId: fabric, quantity: 1 }, { productId: thread, quantity: 1 }]);
    const approved = await owner.post(`/purchasing/requests/${req._id}/decision`, { decision: 'APPROVED', expectedVersion: req.version });
    const body = { supplierId: supplier, lines: [{ productId: fabric, unitCost: 1 }, { productId: thread, unitCost: 1 }], expectedVersion: approved.body.data.version };
    const results = await Promise.all([1, 2, 3].map(() => requester.post(`/purchasing/requests/${req._id}/convert`, body)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    const orders = await owner.get('/purchasing/orders?limit=100');
    expect(orders.body.data.filter((o: { requestId?: string }) => o.requestId === req._id)).toHaveLength(1);
  });

  it('lists my requests and isolates tenants', async () => {
    const mine = await requester.get('/purchasing/requests?mine=true&limit=100');
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBeGreaterThanOrEqual(4);
    const req = mine.body.data[0];
    expect((await other.get(`/purchasing/requests/${req._id}`)).status).toBe(404);
    expect((await other.get('/purchasing/requests')).body.data).toEqual([]);
    expect((await other.post(`/purchasing/requests/${req._id}/cancel`)).status).toBe(404);
  });
});

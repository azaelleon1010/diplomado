import { describe, it, expect } from 'vitest';
import {
  createPurchaseOrder,
  createSupplier,
  deactivateSupplier,
  transitionPurchaseOrder,
  updatePurchaseOrder,
  type PurchasingDeps,
} from '../../apps/api/src/modules/purchasing/application/usecases';
import type { ISupplierStore, IPurchaseOrderStore } from '../../apps/api/src/modules/purchasing/domain/ports';
import type { IProductStore } from '../../apps/api/src/modules/inventory/domain/ports';
import type { PurchaseOrder, Supplier } from '../../apps/api/src/modules/purchasing/domain/entities';

function makeDeps() {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const now = () => new Date();
  const suppliers = new Map<string, Supplier>();
  const orders = new Map<string, PurchaseOrder>();
  const audits: unknown[] = [];
  const catalog = new Map<string, { status: string; sku: string }>([
    ['prod-1', { status: 'ACTIVE', sku: 'P-1' }],
    ['prod-2', { status: 'ACTIVE', sku: 'P-2' }],
    ['prod-off', { status: 'INACTIVE', sku: 'OFF' }],
  ]);

  const products: IProductStore = {
    findById: async (tenantId, pid) => {
      const p = catalog.get(pid);
      if (!p) return null;
      return {
        _id: pid, tenantId, sku: p.sku, name: p.sku, unit: 'pza',
        cost: 1, price: 2, minimumStock: 0, trackInventory: true,
        status: p.status as 'ACTIVE' | 'INACTIVE',
        createdAt: now(), updatedAt: now(), version: 1,
      };
    },
    findBySku: async () => null,
    findByBarcode: async () => null,
    list: async () => ({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
    create: async () => { throw new Error('not implemented in fake'); },
    update: async () => null,
  };

  const supplierStore: ISupplierStore = {
    findById: async (tenantId, sid) => {
      const s = suppliers.get(sid);
      return s && s.tenantId === tenantId ? s : null;
    },
    findByCode: async (tenantId, code) =>
      [...suppliers.values()].find((s) => s.tenantId === tenantId && s.code === code.toUpperCase()) ?? null,
    list: async (tenantId) => {
      const data = [...suppliers.values()].filter((s) => s.tenantId === tenantId);
      return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
    },
    create: async (data) => {
      const s: Supplier = {
        _id: id('sup'), tenantId: data.tenantId, code: data.code.toUpperCase(), name: data.name,
        contactName: data.contactName, email: data.email, phone: data.phone,
        address: data.address, taxId: data.taxId, status: 'ACTIVE',
        createdAt: now(), updatedAt: now(), version: 1,
      };
      suppliers.set(s._id, s);
      return s;
    },
    update: async (tenantId, sid, patch, expectedVersion) => {
      const s = suppliers.get(sid);
      if (!s || s.tenantId !== tenantId) return null;
      if (s.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const next = { ...s, ...patch, version: s.version + 1, updatedAt: now() };
      suppliers.set(sid, next);
      return next;
    },
  };

  const orderStore: IPurchaseOrderStore = {
    findById: async (tenantId, oid) => {
      const o = orders.get(oid);
      return o && o.tenantId === tenantId ? o : null;
    },
    findByFolio: async (tenantId, folio) =>
      [...orders.values()].find((o) => o.tenantId === tenantId && o.folio === folio) ?? null,
    list: async (tenantId) => {
      const data = [...orders.values()].filter((o) => o.tenantId === tenantId);
      return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
    },
    countBySupplier: async (tenantId, supplierId) =>
      [...orders.values()].filter((o) => o.tenantId === tenantId && o.supplierId === supplierId).length,
    create: async (data) => {
      const subtotal = data.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
      const o: PurchaseOrder = {
        _id: id('po'), tenantId: data.tenantId, folio: data.folio, supplierId: data.supplierId,
        status: 'DRAFT', expectedDate: data.expectedDate, notes: data.notes,
        lines: data.lines.map((l) => ({ ...l, quantityReceived: 0 })),
        subtotal, createdAt: now(), updatedAt: now(), version: 1,
      };
      orders.set(o._id, o);
      return o;
    },
    update: async (tenantId, oid, patch, expectedVersion) => {
      const o = orders.get(oid);
      if (!o || o.tenantId !== tenantId) return null;
      if (o.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const { lines, ...rest } = patch as Record<string, unknown>;
      const next: PurchaseOrder = {
        ...o,
        ...rest,
        ...(lines !== undefined
          ? {
              lines: (lines as Array<{ productId: string; quantity: number; unitCost: number }>).map((l) => ({ ...l, quantityReceived: 0 })),
              subtotal: (lines as Array<{ productId: string; quantity: number; unitCost: number }>).reduce((s, l) => s + l.quantity * l.unitCost, 0),
            }
          : {}),
        version: o.version + 1,
        updatedAt: now(),
      };
      orders.set(oid, next);
      return next;
    },
    transition: async (tenantId, oid, to, expectedVersion, _updatedBy, extra) => {
      const o = orders.get(oid);
      if (!o || o.tenantId !== tenantId) return null;
      if (o.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const received = new Map((extra?.lines ?? []).map((l) => [l.productId, l.quantityReceived] as const));
      const next: PurchaseOrder = {
        ...o,
        status: to,
        lines: o.lines.map((l) => ({ ...l, quantityReceived: received.get(l.productId) ?? l.quantityReceived })),
        ...(to === 'RECEIVED' || to === 'PARTIALLY_RECEIVED' ? { receivedAt: new Date().toISOString() } : {}),
        version: o.version + 1,
        updatedAt: now(),
      };
      orders.set(oid, next);
      return next;
    },
  };

  const deps: PurchasingDeps = {
    suppliers: supplierStore,
    orders: orderStore,
    products,
    audit: { record: async (event) => { audits.push(event); } },
  };
  return { deps, audits, orders, suppliers };
}

const ctx = { userId: 'u-1', tenantId: 't-1' };

describe('purchasing use cases (fake stores)', () => {
  it('creates suppliers and orders from the catalog with subtotal and audit', async () => {
    const { deps, audits } = makeDeps();
    const supplier = await createSupplier(ctx, { code: 'TN-01', name: 'Textiles del Norte' }, deps);
    expect(supplier.code).toBe('TN-01');
    const order = await createPurchaseOrder(
      ctx,
      {
        folio: 'OC-1',
        supplierId: supplier._id,
        lines: [
          { productId: 'prod-1', quantity: 10, unitCost: 5 },
          { productId: 'prod-2', quantity: 2, unitCost: 7 },
        ],
      },
      deps,
    );
    expect(order.status).toBe('DRAFT');
    expect(order.subtotal).toBe(64);
    expect(order.lines[0]?.quantityReceived).toBe(0);
    expect(audits.length).toBe(2);
  });

  it('validates suppliers, lines and catalog products', async () => {
    const { deps } = makeDeps();
    const supplier = await createSupplier(ctx, { code: 'TN-01', name: 'T' }, deps);
    await expect(createSupplier(ctx, { code: 'tn-01', name: 'Dup' }, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    await expect(
      createPurchaseOrder(ctx, { folio: 'OC-1', supplierId: supplier._id, lines: [] }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    await expect(
      createPurchaseOrder(
        ctx,
        { folio: 'OC-2', supplierId: supplier._id, lines: [{ productId: 'prod-1', quantity: 1, unitCost: -2 }] },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    await expect(
      createPurchaseOrder(
        ctx,
        { folio: 'OC-3', supplierId: supplier._id, lines: [{ productId: 'missing', quantity: 1, unitCost: 1 }] },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    await expect(
      createPurchaseOrder(
        ctx,
        { folio: 'OC-4', supplierId: 'missing', lines: [{ productId: 'prod-1', quantity: 1, unitCost: 1 }] },
        deps,
      ),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('runs send → approve → receive with quantity checks', async () => {
    const { deps } = makeDeps();
    const supplier = await createSupplier(ctx, { code: 'TN-01', name: 'T' }, deps);
    const order = await createPurchaseOrder(
      ctx,
      { folio: 'OC-1', supplierId: supplier._id, lines: [{ productId: 'prod-1', quantity: 10, unitCost: 5 }] },
      deps,
    );
    await expect(transitionPurchaseOrder(ctx, order._id, 'APPROVED', 1, undefined, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    const sent = await transitionPurchaseOrder(ctx, order._id, 'SENT', 1, undefined, deps);
    expect(sent.status).toBe('SENT');
    const approved = await transitionPurchaseOrder(ctx, order._id, 'APPROVED', 2, undefined, deps);
    expect(approved.status).toBe('APPROVED');
    // Over-reception and full-via-partial are rejected.
    await expect(
      transitionPurchaseOrder(ctx, order._id, 'RECEIVED', 3, { lines: [{ productId: 'prod-1', quantityReceived: 11 }] }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    const partial = await transitionPurchaseOrder(
      ctx,
      order._id,
      'PARTIALLY_RECEIVED',
      3,
      { lines: [{ productId: 'prod-1', quantityReceived: 4 }] },
      deps,
    );
    expect(partial.status).toBe('PARTIALLY_RECEIVED');
    expect(partial.lines[0]?.quantityReceived).toBe(4);
    const done = await transitionPurchaseOrder(
      ctx,
      order._id,
      'RECEIVED',
      4,
      { lines: [{ productId: 'prod-1', quantityReceived: 10 }] },
      deps,
    );
    expect(done.status).toBe('RECEIVED');
    expect(done.receivedAt).toBeTruthy();
    await expect(transitionPurchaseOrder(ctx, order._id, 'CANCELLED', 5, undefined, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('edits only drafts and blocks supplier deactivation with orders', async () => {
    const { deps } = makeDeps();
    const supplier = await createSupplier(ctx, { code: 'TN-01', name: 'T' }, deps);
    const order = await createPurchaseOrder(
      ctx,
      { folio: 'OC-1', supplierId: supplier._id, lines: [{ productId: 'prod-1', quantity: 10, unitCost: 5 }] },
      deps,
    );
    const edited = await updatePurchaseOrder(ctx, order._id, { notes: 'Urgente', expectedVersion: 1 }, deps);
    expect(edited.subtotal).toBe(50);
    await transitionPurchaseOrder(ctx, order._id, 'SENT', 2, undefined, deps);
    await expect(updatePurchaseOrder(ctx, order._id, { notes: 'X', expectedVersion: 3 }, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    await expect(deactivateSupplier(ctx, supplier._id, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
  });
});

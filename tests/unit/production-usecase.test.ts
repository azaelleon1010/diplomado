import { describe, it, expect } from 'vitest';
import {
  cancelProductionOrder,
  createProductionOrder,
  transitionProductionOrder,
  updateProductionOrder,
  type ProductionDeps,
} from '../../apps/api/src/modules/production/application/usecases';
import type { IProductionOrderStore } from '../../apps/api/src/modules/production/domain/ports';
import type { IProductStore } from '../../apps/api/src/modules/inventory/domain/ports';
import type { ProductionOrder } from '../../apps/api/src/modules/production/domain/entities';

function makeDeps() {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const now = () => new Date();
  const orders = new Map<string, ProductionOrder>();
  const audits: unknown[] = [];
  const catalog = new Map<string, { status: string; sku: string }>([
    ['prod-fg', { status: 'ACTIVE', sku: 'FG-1' }],
    ['prod-m1', { status: 'ACTIVE', sku: 'MAT-1' }],
    ['prod-m2', { status: 'ACTIVE', sku: 'MAT-2' }],
    ['prod-off', { status: 'INACTIVE', sku: 'OFF-1' }],
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

  const store: IProductionOrderStore = {
    findById: async (tenantId, oid) => {
      const o = orders.get(oid);
      return o && o.tenantId === tenantId ? o : null;
    },
    findByCode: async (tenantId, code) =>
      [...orders.values()].find((o) => o.tenantId === tenantId && o.code === code) ?? null,
    list: async (tenantId) => {
      const data = [...orders.values()].filter((o) => o.tenantId === tenantId);
      return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
    },
    create: async (data) => {
      const o: ProductionOrder = {
        _id: id('po'), tenantId: data.tenantId, code: data.code, productId: data.productId,
        quantity: data.quantity, producedQuantity: 0, status: 'DRAFT',
        machine: data.machine, responsible: data.responsible, dueDate: data.dueDate, notes: data.notes,
        materials: data.materials.map((m) => ({ ...m, quantityConsumed: 0 })),
        createdAt: now(), updatedAt: now(), version: 1,
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
      const { materials, ...rest } = patch as Record<string, unknown>;
      const next = {
        ...o,
        ...rest,
        ...(materials !== undefined
          ? { materials: (materials as Array<{ productId: string; quantityRequired: number }>).map((m) => ({ ...m, quantityConsumed: 0 })) }
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
      const next: ProductionOrder = {
        ...o,
        status: to,
        producedQuantity: extra?.producedQuantity ?? o.producedQuantity,
        materials: extra?.materials
          ? extra.materials.map((m) => ({ ...m, quantityConsumed: m.quantityConsumed ?? 0 }))
          : o.materials,
        ...(to === 'IN_PROGRESS' && !o.startedAt ? { startedAt: new Date().toISOString() } : {}),
        ...(to === 'COMPLETED' ? { completedAt: new Date().toISOString() } : {}),
        version: o.version + 1,
        updatedAt: now(),
      };
      orders.set(oid, next);
      return next;
    },
  };

  const deps: ProductionDeps = {
    orders: store,
    products,
    audit: { record: async (event) => { audits.push(event); } },
  };
  return { deps, audits, orders };
}

const ctx = { userId: 'u-1', tenantId: 't-1' };
const baseInput = {
  code: 'OT-1',
  productId: 'prod-fg',
  quantity: 100,
  materials: [{ productId: 'prod-m1', quantityRequired: 2 }],
};

describe('production use cases (fake stores)', () => {
  it('creates orders from the inventory catalog with audit trail', async () => {
    const { deps, audits } = makeDeps();
    const order = await createProductionOrder(ctx, baseInput, deps);
    expect(order.code).toBe('OT-1');
    expect(order.status).toBe('DRAFT');
    expect(order.materials).toEqual([{ productId: 'prod-m1', quantityRequired: 2, quantityConsumed: 0 }]);
    expect(audits.length).toBe(1);
  });

  it('rejects unknown or inactive products and bad quantities', async () => {
    const { deps } = makeDeps();
    await expect(createProductionOrder(ctx, { ...baseInput, productId: 'missing' }, deps)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
    await expect(createProductionOrder(ctx, { ...baseInput, code: 'OT-2', productId: 'prod-off' }, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    await expect(createProductionOrder(ctx, { ...baseInput, code: 'OT-3', quantity: 0 }, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    await expect(
      createProductionOrder(ctx, { ...baseInput, code: 'OT-4', materials: [{ productId: 'prod-m1', quantityRequired: 0 }] }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });

  it('rejects duplicate codes per tenant but allows across tenants', async () => {
    const { deps } = makeDeps();
    await createProductionOrder(ctx, baseInput, deps);
    await expect(createProductionOrder(ctx, baseInput, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    const other = await createProductionOrder({ ...ctx, tenantId: 't-2' }, baseInput, deps);
    expect(other.tenantId).toBe('t-2');
  });

  it('runs the full lifecycle with consumption snapshot on complete', async () => {
    const { deps } = makeDeps();
    const order = await createProductionOrder(ctx, baseInput, deps);
    await expect(transitionProductionOrder(ctx, order._id, 'IN_PROGRESS', 1, undefined, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    const released = await transitionProductionOrder(ctx, order._id, 'RELEASED', 1, undefined, deps);
    expect(released.status).toBe('RELEASED');
    const started = await transitionProductionOrder(ctx, order._id, 'IN_PROGRESS', 2, undefined, deps);
    expect(started.status).toBe('IN_PROGRESS');
    const done = await transitionProductionOrder(ctx, order._id, 'COMPLETED', 3, { producedQuantity: 98 }, deps);
    expect(done.status).toBe('COMPLETED');
    expect(done.producedQuantity).toBe(98);
    expect(done.materials).toEqual([{ productId: 'prod-m1', quantityRequired: 2, quantityConsumed: 2 }]);
    await expect(transitionProductionOrder(ctx, order._id, 'PAUSED', 4, undefined, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('blocks edits on terminal orders and cancels open ones', async () => {
    const { deps } = makeDeps();
    const order = await createProductionOrder(ctx, baseInput, deps);
    const cancelled = await cancelProductionOrder(ctx, order._id, deps);
    expect(cancelled.status).toBe('CANCELLED');
    await expect(updateProductionOrder(ctx, order._id, { quantity: 5, expectedVersion: 2 }, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });
});

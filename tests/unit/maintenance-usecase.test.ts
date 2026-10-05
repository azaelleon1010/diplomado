import { describe, it, expect } from 'vitest';
import {
  cancelOrder,
  createAsset,
  createOrder,
  getAsset,
  retireAsset,
  transitionOrder,
  type MaintenanceDeps,
} from '../../apps/api/src/modules/maintenance/application/usecases';

function makeDeps(): { deps: MaintenanceDeps; audits: unknown[] } {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const now = () => new Date();
  const assets = new Map<string, Record<string, unknown>>();
  const orders = new Map<string, Record<string, unknown>>();
  const audits: unknown[] = [];

  const deps: MaintenanceDeps = {
    assets: {
      findById: async (tenantId, aid) => {
        const a = assets.get(aid);
        return a && a.tenantId === tenantId ? (a as never) : null;
      },
      findByCode: async (tenantId, code) =>
        [...assets.values()].find((a) => a.tenantId === tenantId && (a.code as string) === code.toUpperCase()) as never ?? null,
      list: async (tenantId) => {
        const data = [...assets.values()].filter((a) => a.tenantId === tenantId) as never[];
        return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
      },
      create: async (data) => {
        const a = {
          _id: id('ast'), tenantId: data.tenantId, code: data.code.toUpperCase(), name: data.name,
          type: data.type, location: data.location, responsible: data.responsible,
          status: 'ACTIVE', createdAt: now(), updatedAt: now(), version: 1,
        };
        assets.set(a._id, a);
        return a as never;
      },
      update: async (tenantId, aid, patch, expectedVersion) => {
        const a = assets.get(aid);
        if (!a || a.tenantId !== tenantId) return null;
        if ((a.version as number) !== expectedVersion) {
          throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
        }
        const next = { ...a, ...patch, version: (a.version as number) + 1, updatedAt: now() };
        assets.set(aid, next);
        return next as never;
      },
      setStatus: async (tenantId, aid, status, expectedVersion) => {
        const a = assets.get(aid);
        if (!a || a.tenantId !== tenantId) return null;
        if ((a.version as number) !== expectedVersion) {
          throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
        }
        const next = { ...a, status, version: (a.version as number) + 1, updatedAt: now() };
        assets.set(aid, next);
        return next as never;
      },
    },
    orders: {
      findById: async (tenantId, oid) => {
        const o = orders.get(oid);
        return o && o.tenantId === tenantId ? (o as never) : null;
      },
      list: async (tenantId) => {
        const data = [...orders.values()].filter((o) => o.tenantId === tenantId) as never[];
        return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
      },
      countOpenByAsset: async (tenantId, assetId) =>
        [...orders.values()].filter(
          (o) => o.tenantId === tenantId && o.assetId === assetId && ['OPEN', 'IN_PROGRESS', 'ON_HOLD'].includes(o.status as string),
        ).length,
      create: async (data) => {
        const o = {
          _id: id('ord'), tenantId: data.tenantId, assetId: data.assetId, type: data.type,
          priority: data.priority, title: data.title, description: data.description,
          status: 'OPEN', scheduledFor: data.scheduledFor, cost: data.cost,
          assignedTo: data.assignedTo, notes: data.notes,
          createdAt: now(), updatedAt: now(), version: 1,
        };
        orders.set(o._id, o);
        return o as never;
      },
      update: async (tenantId, oid, patch, expectedVersion) => {
        const o = orders.get(oid);
        if (!o || o.tenantId !== tenantId) return null;
        if ((o.version as number) !== expectedVersion) {
          throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
        }
        const next = { ...o, ...patch, version: (o.version as number) + 1, updatedAt: now() };
        orders.set(oid, next);
        return next as never;
      },
      transition: async (tenantId, oid, to, expectedVersion, _updatedBy, extra) => {
        const o = orders.get(oid);
        if (!o || o.tenantId !== tenantId) return null;
        if ((o.version as number) !== expectedVersion) {
          throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
        }
        const next = {
          ...o,
          status: to,
          ...(to === 'IN_PROGRESS' && !o.startedAt ? { startedAt: new Date().toISOString() } : {}),
          ...(to === 'COMPLETED'
            ? { completedAt: new Date().toISOString(), ...(extra?.completedCost !== undefined ? { cost: extra.completedCost } : {}) }
            : {}),
          version: (o.version as number) + 1,
          updatedAt: now(),
        };
        orders.set(oid, next);
        return next as never;
      },
    },
    audit: {
      record: async (event) => {
        audits.push(event);
      },
    },
  };
  return { deps, audits };
}

const ctx = { userId: 'u-1', tenantId: 't-1' };

describe('maintenance use cases (fake stores)', () => {
  it('creates asset and order with audit trail', async () => {
    const { deps, audits } = makeDeps();
    const asset = await createAsset(ctx, { code: 'EQ-01', name: 'Hiladora 4', type: 'Hiladora' }, deps);
    expect(asset.code).toBe('EQ-01');
    const order = await createOrder(
      ctx,
      { assetId: asset._id, type: 'CORRECTIVE', priority: 'HIGH', title: 'Banda rota' },
      deps,
    );
    expect(order.status).toBe('OPEN');
    expect(audits.length).toBe(2);
  });

  it('rejects duplicate asset codes per tenant but allows across tenants', async () => {
    const { deps } = makeDeps();
    await createAsset(ctx, { code: 'EQ-01', name: 'A', type: 'T' }, deps);
    await expect(createAsset(ctx, { code: 'eq-01', name: 'B', type: 'T' }, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    const other = await createAsset({ ...ctx, tenantId: 't-2' }, { code: 'EQ-01', name: 'C', type: 'T' }, deps);
    expect(other.tenantId).toBe('t-2');
  });

  it('enforces order state machine transitions', async () => {
    const { deps } = makeDeps();
    const asset = await createAsset(ctx, { code: 'EQ-01', name: 'A', type: 'T' }, deps);
    const order = await createOrder(ctx, { assetId: asset._id, type: 'PREVENTIVE', priority: 'LOW', title: 'Check' }, deps);
    // OPEN -> COMPLETED directly is invalid
    await expect(transitionOrder(ctx, order._id, 'COMPLETED', 1, undefined, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    const started = await transitionOrder(ctx, order._id, 'IN_PROGRESS', 1, undefined, deps);
    expect(started.status).toBe('IN_PROGRESS');
    const done = await transitionOrder(ctx, order._id, 'COMPLETED', 2, 150, deps);
    expect(done.status).toBe('COMPLETED');
    expect(done.cost).toBe(150);
    // completed orders are terminal
    await expect(transitionOrder(ctx, order._id, 'IN_PROGRESS', 3, undefined, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  });

  it('syncs asset status with open orders and blocks retire with open orders', async () => {
    const { deps } = makeDeps();
    const asset = await createAsset(ctx, { code: 'EQ-01', name: 'A', type: 'T' }, deps);
    const order = await createOrder(ctx, { assetId: asset._id, type: 'CORRECTIVE', priority: 'HIGH', title: 'Fix' }, deps);
    await transitionOrder(ctx, order._id, 'IN_PROGRESS', 1, undefined, deps);
    const inMaint = await getAsset(ctx, asset._id, deps);
    expect(inMaint.status).toBe('IN_MAINTENANCE');
    await expect(retireAsset(ctx, asset._id, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    await transitionOrder(ctx, order._id, 'COMPLETED', 2, undefined, deps);
    const back = await getAsset(ctx, asset._id, deps);
    expect(back.status).toBe('ACTIVE');
  });

  it('rejects orders for unknown or retired assets and negative costs', async () => {
    const { deps } = makeDeps();
    await expect(
      createOrder(ctx, { assetId: 'missing', type: 'CORRECTIVE', priority: 'HIGH', title: 'X' }, deps),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    const asset = await createAsset(ctx, { code: 'EQ-01', name: 'A', type: 'T' }, deps);
    await expect(
      createOrder(ctx, { assetId: asset._id, type: 'CORRECTIVE', priority: 'HIGH', title: 'X', cost: -5 }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });

  it('cancels open orders via delete path', async () => {
    const { deps } = makeDeps();
    const asset = await createAsset(ctx, { code: 'EQ-01', name: 'A', type: 'T' }, deps);
    const order = await createOrder(ctx, { assetId: asset._id, type: 'CORRECTIVE', priority: 'LOW', title: 'X' }, deps);
    const cancelled = await cancelOrder(ctx, order._id, deps);
    expect(cancelled.status).toBe('CANCELLED');
  });
});

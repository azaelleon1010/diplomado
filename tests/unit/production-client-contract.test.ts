import { describe, it, expect } from 'vitest';
import { openApiSpec } from '../../apps/api/src/openapi';
import type { InventoryRequestOptions } from '../../packages/types/src/inventory';
import { createProductionApi, describeProductionError, productionOrderActions, progressPercent } from '../../packages/types/src/production';

/** "/api/v1/production/orders/abc/transition" → "/production/orders/{id}/transition". */
function toSpecPath(path: string): string {
  return path
    .replace(/^\/api\/v1/, '')
    .split('?')[0]!
    .split('/')
    .map((segment, i, all) => (i > 0 && segment === 'ID' ? '{id}' : segment) || all[i]!)
    .join('/');
}

describe('shared production client contract', () => {
  it('only calls operations documented by the API (method + path)', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    const record = async (path: string, options: InventoryRequestOptions) => {
      calls.push({ method: options.method ?? 'GET', path });
      return {} as never;
    };
    const api = createProductionApi({ request: record, page: async (path, options) => ({ data: (await record(path, options)) ?? [] }) });
    const t = 'tok';
    await api.listOrders(t, { status: 'IN_PROGRESS' });
    await api.getOrder(t, 'ID');
    await api.createOrder(t, { code: 'OP', productId: 'p', quantity: 10 });
    await api.transitionOrder(t, 'ID', 'RELEASED', 1);
    await api.cancelOrder(t, 'ID');

    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
    const undocumented = calls.filter((c) => !paths[toSpecPath(c.path)]?.[c.method.toLowerCase()]).map((c) => `${c.method} ${c.path}`);
    expect(undocumented).toEqual([]);
    expect(calls).toHaveLength(5);
  });

  it('shows order actions with the same permissions the API enforces', () => {
    const all = ['production.update', 'production.delete'];
    expect(productionOrderActions({ status: 'DRAFT' }, all)).toEqual(['RELEASE', 'CANCEL']);
    expect(productionOrderActions({ status: 'DRAFT' }, ['production.delete'])).toEqual(['CANCEL']);
    expect(productionOrderActions({ status: 'RELEASED' }, all)).toEqual(['START', 'CANCEL']);
    expect(productionOrderActions({ status: 'PAUSED' }, all)).toEqual(['START', 'CANCEL']);
    expect(productionOrderActions({ status: 'IN_PROGRESS' }, all)).toEqual(['PAUSE', 'COMPLETE']);
    expect(productionOrderActions({ status: 'IN_PROGRESS' }, [])).toEqual([]);
    expect(productionOrderActions({ status: 'COMPLETED' }, ['*'])).toEqual([]);
  });

  it('computes progress and Spanish error messages', () => {
    expect(progressPercent({ quantity: 10, producedQuantity: 5 })).toBe(50);
    expect(progressPercent({ quantity: 0, producedQuantity: 0 })).toBe(0);
    expect(describeProductionError({ code: 'VERSION_CONFLICT' })).toContain('Otro usuario');
    expect(describeProductionError({ code: 'FORBIDDEN' })).toContain('no permite');
    expect(describeProductionError({ code: 'OTHER' })).toBeNull();
  });
});

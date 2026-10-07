import { describe, it, expect } from 'vitest';
import { openApiSpec } from '../../apps/api/src/openapi';
import type { InventoryRequestOptions } from '../../packages/types/src/inventory';
import { createMaintenanceApi, describeMaintenanceError, maintenanceOrderActions } from '../../packages/types/src/maintenance';

/** "/api/v1/maintenance/orders/abc/transition" → "/maintenance/orders/{id}/transition". */
function toSpecPath(path: string): string {
  return path
    .replace(/^\/api\/v1/, '')
    .split('?')[0]!
    .split('/')
    .map((segment, i, all) => (i > 0 && segment === 'ID' ? '{id}' : segment) || all[i]!)
    .join('/');
}

describe('shared maintenance client contract', () => {
  it('only calls operations documented by the API (method + path)', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    const record = async (path: string, options: InventoryRequestOptions) => {
      calls.push({ method: options.method ?? 'GET', path });
      return {} as never;
    };
    const api = createMaintenanceApi({ request: record, page: async (path, options) => ({ data: (await record(path, options)) ?? [] }) });
    const t = 'tok';
    await api.listAssets(t, { search: 'x' });
    await api.getAsset(t, 'ID');
    await api.createAsset(t, { code: 'A', name: 'Activo', type: 'Torno' });
    await api.updateAsset(t, 'ID', { expectedVersion: 1 });
    await api.retireAsset(t, 'ID');
    await api.listOrders(t, { status: 'OPEN' });
    await api.getOrder(t, 'ID');
    await api.createOrder(t, { assetId: 'a', type: 'CORRECTIVE', priority: 'MEDIUM', title: 'Falla' });
    await api.transitionOrder(t, 'ID', 'IN_PROGRESS', 1);
    await api.cancelOrder(t, 'ID');

    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
    const undocumented = calls.filter((c) => !paths[toSpecPath(c.path)]?.[c.method.toLowerCase()]).map((c) => `${c.method} ${c.path}`);
    expect(undocumented).toEqual([]);
    expect(calls).toHaveLength(10);
  });

  it('shows order actions with the same permissions the API enforces', () => {
    const all = ['maintenance.update', 'maintenance.delete'];
    expect(maintenanceOrderActions({ status: 'OPEN' }, all)).toEqual(['START', 'CANCEL']);
    expect(maintenanceOrderActions({ status: 'OPEN' }, ['maintenance.delete'])).toEqual(['CANCEL']);
    expect(maintenanceOrderActions({ status: 'ON_HOLD' }, all)).toEqual(['START', 'CANCEL']);
    expect(maintenanceOrderActions({ status: 'IN_PROGRESS' }, all)).toEqual(['HOLD', 'COMPLETE', 'CANCEL']);
    expect(maintenanceOrderActions({ status: 'IN_PROGRESS' }, [])).toEqual([]);
    expect(maintenanceOrderActions({ status: 'COMPLETED' }, ['*'])).toEqual([]);
  });

  it('shows Spanish error messages for business errors', () => {
    expect(describeMaintenanceError({ code: 'VERSION_CONFLICT' })).toContain('Otro usuario');
    expect(describeMaintenanceError({ code: 'CONFLICT', message: 'asset has open orders' })).toContain('órdenes abiertas');
    expect(describeMaintenanceError({ code: 'OTHER' })).toBeNull();
  });
});

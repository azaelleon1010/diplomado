import { describe, it, expect } from 'vitest';
import { openApiSpec } from '../../apps/api/src/openapi';
import type { InventoryRequestOptions } from '../../packages/types/src/inventory';
import { createFinanceApi, describeFinanceError, formatMoney } from '../../packages/types/src/finance';

/** "/api/v1/finance/movements/abc/void" → "/finance/movements/{id}/void". */
function toSpecPath(path: string): string {
  return path
    .replace(/^\/api\/v1/, '')
    .split('?')[0]!
    .split('/')
    .map((segment, i, all) => (i > 0 && segment === 'ID' ? '{id}' : segment) || all[i]!)
    .join('/');
}

describe('shared finance client contract', () => {
  it('only calls operations documented by the API (method + path)', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    const record = async (path: string, options: InventoryRequestOptions) => {
      calls.push({ method: options.method ?? 'GET', path });
      return {} as never;
    };
    const api = createFinanceApi({ request: record, page: async (path, options) => ({ data: (await record(path, options)) ?? [] }) });
    const t = 'tok';
    await api.listAccounts(t, { search: 'x' });
    await api.createAccount(t, { code: 'A', name: 'Caja', type: 'ASSET' });
    await api.updateAccount(t, 'ID', { expectedVersion: 1 });
    await api.deactivateAccount(t, 'ID');
    await api.listCategories(t, { kind: 'EXPENSE' });
    await api.createCategory(t, { name: 'Renta', kind: 'EXPENSE' });
    await api.updateCategory(t, 'ID', { expectedVersion: 1 });
    await api.deactivateCategory(t, 'ID');
    await api.listMovements(t, { kind: 'INCOME' });
    await api.getMovement(t, 'ID');
    await api.createMovement(t, { accountId: 'a', kind: 'INCOME', amount: 100, method: 'CASH', concept: 'Venta', date: '2026-01-01' });
    await api.voidMovement(t, 'ID', 1);
    await api.totals(t, { accountId: 'a' });

    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
    const undocumented = calls.filter((c) => !paths[toSpecPath(c.path)]?.[c.method.toLowerCase()]).map((c) => `${c.method} ${c.path}`);
    expect(undocumented).toEqual([]);
    expect(calls).toHaveLength(13);
  });

  it('formats money and shows Spanish error messages for business errors', () => {
    expect(formatMoney(1234.5)).toContain('1,234.50');
    expect(describeFinanceError({ code: 'VERSION_CONFLICT' })).toContain('Otro usuario');
    expect(describeFinanceError({ code: 'CONFLICT', message: 'account has movements' })).toContain('movimientos registrados');
    expect(describeFinanceError({ code: 'OTHER' })).toBeNull();
  });
});

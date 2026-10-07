import { describe, it, expect } from 'vitest';
import { openApiSpec } from '../../apps/api/src/openapi';
import type { InventoryRequestOptions } from '../../packages/types/src/inventory';
import {
  createPurchasingApi,
  describePurchasingError,
  orderActions,
  pendingToInvoice,
  pendingToReceive,
  requestActions,
} from '../../packages/types/src/purchasing';

/** "/api/v1/purchasing/orders/abc/receipts?x=1" → "/purchasing/orders/{id}/receipts". */
function toSpecPath(path: string): string {
  return path
    .replace(/^\/api\/v1/, '')
    .split('?')[0]!
    .split('/')
    .map((segment, i, all) => (i > 0 && segment === 'ID' ? '{id}' : segment) || all[i]!)
    .join('/');
}

describe('shared purchasing client contract', () => {
  it('only calls operations documented by the API (method + path)', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    const record = async (path: string, options: InventoryRequestOptions) => {
      calls.push({ method: options.method ?? 'GET', path });
      return {} as never;
    };
    const api = createPurchasingApi({ request: record, page: async (path, options) => ({ data: (await record(path, options)) ?? [] }) });
    const t = 'tok';
    await api.listSuppliers(t, { search: 'x' });
    await api.createSupplier(t, { code: 'A', name: 'Proveedor' });
    await api.updateSupplier(t, 'ID', { expectedVersion: 1 });
    await api.deactivateSupplier(t, 'ID');
    await api.listOrders(t, { status: 'APPROVED' });
    await api.getOrder(t, 'ID');
    await api.createOrder(t, { folio: 'OC', supplierId: 's', lines: [] });
    await api.transitionOrder(t, 'ID', 'APPROVED', 1);
    await api.receiveOrder(t, 'ID', { warehouseId: 'w', lines: [], idempotencyKey: 'k-12345678' });
    await api.listReceipts(t, { purchaseOrderId: 'o' });
    await api.listRequests(t, { mine: true });
    await api.getRequest(t, 'ID');
    await api.createRequest(t, { lines: [] });
    await api.submitRequest(t, 'ID', 1);
    await api.decideRequest(t, 'ID', 'REJECTED', 1, 'motivo');
    await api.cancelRequest(t, 'ID');
    await api.convertRequest(t, 'ID', { supplierId: 's', lines: [], expectedVersion: 1 });
    await api.compareQuotes(t, 'ID');
    await api.createQuote(t, 'ID', { supplierId: 's', lines: [] });
    await api.awardQuote(t, 'ID', 1);
    await api.listInvoices(t, { open: true });
    await api.registerInvoice(t, { purchaseOrderId: 'o', supplierInvoiceNumber: 'F', invoiceDate: '2026-01-01', lines: [], idempotencyKey: 'k-12345678' });
    await api.releaseInvoice(t, 'ID', 1);
    await api.cancelInvoice(t, 'ID', 'motivo', 1);
    await api.payables(t);

    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
    const undocumented = calls.filter((c) => !paths[toSpecPath(c.path)]?.[c.method.toLowerCase()]).map((c) => `${c.method} ${c.path}`);
    expect(undocumented).toEqual([]);
    expect(calls).toHaveLength(25);
  });

  it('shows order actions with the same permissions the API enforces', () => {
    const all = ['purchasing.update', 'purchasing.approve', 'purchasing.receive', 'purchasing.cancel'];
    expect(orderActions({ status: 'DRAFT' }, all)).toEqual(['EDIT', 'SEND', 'CANCEL']);
    expect(orderActions({ status: 'SENT' }, ['purchasing.update'])).toEqual([]);
    expect(orderActions({ status: 'SENT' }, all)).toEqual(['APPROVE', 'CANCEL']);
    expect(orderActions({ status: 'PARTIALLY_RECEIVED' }, ['purchasing.receive'])).toEqual(['RECEIVE']);
    expect(orderActions({ status: 'RECEIVED' }, ['*'])).toEqual([]);
    expect(requestActions({ status: 'SUBMITTED' }, ['purchasing.create'])).toEqual(['QUOTE']);
    expect(requestActions({ status: 'SUBMITTED' }, ['purchasing.approve'])).toEqual(['DECIDE']);
    expect(requestActions({ status: 'APPROVED' }, ['*'])).toEqual(['QUOTE', 'CONVERT', 'CANCEL']);
  });

  it('computes pending quantities and Spanish error messages', () => {
    const line = { productId: 'p', quantity: 10, unitCost: 1, quantityReceived: 6.5, quantityInvoiced: 2 };
    expect(pendingToReceive(line)).toBe(3.5);
    expect(pendingToInvoice(line)).toBe(4.5);
    expect(describePurchasingError({ code: 'VALIDATION_ERROR', fields: { pending: 4 } })).toContain('pendiente: 4');
    expect(describePurchasingError({ code: 'VALIDATION_ERROR', fields: { billable: 2 } })).toContain('disponible: 2');
    expect(describePurchasingError({ code: 'OTHER' })).toBeNull();
  });
});

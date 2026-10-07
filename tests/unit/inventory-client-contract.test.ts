import { describe, it, expect } from 'vitest';
import {
  EMPTY_PRODUCT_FORM,
  createInventoryApi,
  createStockApi,
  newIdempotencyKey,
  parseStockQuantity,
  isVersionConflict,
  productToFormValues,
  toCreateProductPayload,
  toUpdateProductPayload,
  validateProductForm,
  type InventoryProduct,
  type InventoryRequestOptions,
  type ProductFormValues,
} from '../../packages/types/src/inventory';
import { createProductSchema, updateProductSchema } from '../../apps/api/src/modules/inventory/presentation/schemas';

const form = (values: Partial<ProductFormValues>): ProductFormValues => ({ ...EMPTY_PRODUCT_FORM, ...values });

function validFields(values: Partial<ProductFormValues>) {
  const result = validateProductForm(form(values));
  if (!result.ok) throw new Error(result.error);
  return result.fields;
}

describe('shared inventory form rules (Web + Mobile)', () => {
  it('requires SKU and name like the API schema', () => {
    expect(validateProductForm(form({ sku: '  ', name: 'Tela' }))).toMatchObject({ ok: false, field: 'sku' });
    expect(validateProductForm(form({ sku: 'A-1', name: ' ' }))).toMatchObject({ ok: false, field: 'name' });
    expect(validateProductForm(form({ sku: 'A-1', name: 'X' }))).toMatchObject({ ok: false, field: 'name' });
    expect(validateProductForm(form({ sku: 'x'.repeat(65), name: 'Tela' }))).toMatchObject({ ok: false, field: 'sku' });
  });

  it('accepts comma decimals from Android keyboards and rejects invalid amounts', () => {
    expect(validFields({ sku: 'A-1', name: 'Tela', cost: '12,5', price: '20.75' })).toMatchObject({ cost: 12.5, price: 20.75 });
    expect(validateProductForm(form({ sku: 'A-1', name: 'Tela', cost: '-1' }))).toMatchObject({ ok: false, field: 'cost' });
    expect(validateProductForm(form({ sku: 'A-1', name: 'Tela', price: 'abc' }))).toMatchObject({ ok: false, field: 'price' });
    expect(validateProductForm(form({ sku: 'A-1', name: 'Tela', cost: '' }))).toMatchObject({ ok: false, field: 'cost' });
  });

  it('requires integer stock bounds with maximum >= minimum', () => {
    expect(validateProductForm(form({ sku: 'A-1', name: 'Tela', minimumStock: '1.5' }))).toMatchObject({ ok: false, field: 'minimumStock' });
    expect(validateProductForm(form({ sku: 'A-1', name: 'Tela', minimumStock: '10', maximumStock: '5' }))).toMatchObject({ ok: false, field: 'maximumStock' });
    expect(validFields({ sku: 'A-1', name: 'Tela', minimumStock: '', maximumStock: '' })).toMatchObject({ minimumStock: 0, maximumStock: undefined });
  });

  it('defaults an empty unit to PZA like the Web form', () => {
    expect(validFields({ sku: 'A-1', name: 'Tela', unit: ' ' }).unit).toBe('PZA');
  });

  it('builds create payloads accepted by createProductSchema without empty optionals', () => {
    const payload = toCreateProductPayload(validFields({ sku: ' A-1 ', name: ' Tela ', description: ' ', barcode: '', categoryId: '' }));
    expect(payload).toEqual({ sku: 'A-1', name: 'Tela', unit: 'PZA', cost: 0, price: 0, minimumStock: 0, trackInventory: true });
    expect(createProductSchema.safeParse(payload).success).toBe(true);
  });

  it('builds update payloads accepted by updateProductSchema, clearing emptied fields with null', () => {
    const payload = toUpdateProductPayload(validFields({ sku: 'A-1', name: 'Tela', description: '', categoryId: '', barcode: '', maximumStock: '' }), 4);
    expect(payload).toMatchObject({ description: null, categoryId: null, barcode: null, maximumStock: null, expectedVersion: 4 });
    expect(updateProductSchema.safeParse(payload).success).toBe(true);
  });

  it('round-trips a product through the form without losing values', () => {
    const product: InventoryProduct = {
      _id: 'p1', tenantId: 't1', sku: 'A-1', name: 'Tela', description: 'Azul', categoryId: 'c1', unit: 'MT', barcode: '750',
      cost: 10.5, price: 20, minimumStock: 2, maximumStock: 9, trackInventory: false, status: 'ACTIVE',
      createdAt: '', updatedAt: '', version: 3,
    };
    const fields = validFields(productToFormValues(product));
    expect(toUpdateProductPayload(fields, product.version)).toEqual({
      sku: 'A-1', name: 'Tela', description: 'Azul', categoryId: 'c1', unit: 'MT', barcode: '750',
      cost: 10.5, price: 20, minimumStock: 2, maximumStock: 9, trackInventory: false, expectedVersion: 3,
    });
  });

  it('recognizes the API version conflict code', () => {
    expect(isVersionConflict({ code: 'VERSION_CONFLICT', status: 409 })).toBe(true);
    expect(isVersionConflict({ code: 'CONFLICT', status: 409 })).toBe(false);
    expect(isVersionConflict(null)).toBe(false);
  });
});

describe('shared inventory HTTP contract', () => {
  function recordingApi(meta?: Record<string, unknown>) {
    const calls: Array<{ path: string; options: InventoryRequestOptions }> = [];
    const api = createInventoryApi({
      request: async <T>(path: string, options: InventoryRequestOptions) => {
        calls.push({ path, options });
        return {} as T;
      },
      page: async <T>(path: string, options: InventoryRequestOptions) => {
        calls.push({ path, options });
        return { data: [] as unknown as T, meta };
      },
    });
    return { api, calls };
  }

  it('uses only the routes that exist in the inventory router', async () => {
    const { api, calls } = recordingApi();
    await api.listProducts('tok', { search: ' tela ', status: 'ACTIVE' });
    await api.listCategories('tok');
    await api.getProduct('tok', 'p/1');
    await api.createProduct('tok', toCreateProductPayload(validFields({ sku: 'A-1', name: 'Tela' })));
    await api.updateProduct('tok', 'p1', toUpdateProductPayload(validFields({ sku: 'A-1', name: 'Tela' }), 2));
    await api.deactivateProduct('tok', 'p1');
    await api.activateProduct('tok', 'p1', 5);

    expect(calls.map((c) => `${c.options.method ?? 'GET'} ${c.path}`)).toEqual([
      'GET /api/v1/inventory/products?search=tela&status=ACTIVE&page=1&limit=100',
      'GET /api/v1/inventory/categories?page=1&limit=100',
      'GET /api/v1/inventory/products/p%2F1',
      'POST /api/v1/inventory/products',
      'PATCH /api/v1/inventory/products/p1',
      'DELETE /api/v1/inventory/products/p1',
      'PATCH /api/v1/inventory/products/p1',
    ]);
    expect(calls.every((c) => c.options.token === 'tok')).toBe(true);
    expect(calls[4]?.options.body).toMatchObject({ expectedVersion: 2 });
    expect(calls[5]?.options.body).toBeUndefined();
    expect(calls[6]?.options.body).toEqual({ status: 'ACTIVE', expectedVersion: 5 });
    // Never sends tenant context from the client.
    expect(JSON.stringify(calls.map((c) => c.options.body ?? null))).not.toContain('tenantId');
  });

  it('exposes the server total so a truncated first page is visible', async () => {
    const { api } = recordingApi({ page: 1, limit: 100, total: 250, totalPages: 3 });
    await expect(api.listProductsPage('tok')).resolves.toMatchObject({ total: 250, totalPages: 3, limit: 100 });
  });
});

describe('shared stock ledger client contract', () => {
  it('uses the ledger routes with the exact methods and bodies', async () => {
    const calls: Array<{ path: string; options: InventoryRequestOptions }> = [];
    const api = createStockApi({
      request: async <T>(path: string, options: InventoryRequestOptions) => {
        calls.push({ path, options });
        return {} as T;
      },
      page: async <T>(path: string, options: InventoryRequestOptions) => {
        calls.push({ path, options });
        return { data: [] as unknown as T, meta: { total: 7 } };
      },
    });
    await api.listWarehouses('tok');
    await api.listStock('tok', { productId: 'p1', nonZero: true });
    await api.listMovements('tok', { warehouseId: 'w1', type: 'RECEIPT' });
    await api.postMovements('tok', { lines: [{ productId: 'p1', warehouseId: 'w1', type: 'RECEIPT', quantity: 2 }], idempotencyKey: 'k-12345678' });
    await api.transfer('tok', { productId: 'p1', fromWarehouseId: 'w1', toWarehouseId: 'w2', quantity: 1, idempotencyKey: 'k-87654321' });
    await api.createWarehouse('tok', { code: 'A', name: 'Almacén' });

    expect(calls.map((c) => `${c.options.method ?? 'GET'} ${c.path}`)).toEqual([
      'GET /api/v1/inventory/warehouses?page=1&limit=100',
      'GET /api/v1/inventory/stock?productId=p1&nonZero=true&page=1&limit=100',
      'GET /api/v1/inventory/movements?warehouseId=w1&type=RECEIPT&page=1&limit=50',
      'POST /api/v1/inventory/movements',
      'POST /api/v1/inventory/transfers',
      'POST /api/v1/inventory/warehouses',
    ]);
    expect(JSON.stringify(calls.map((c) => c.options.body ?? null))).not.toContain('tenantId');
    expect((await api.listStock('tok')).total).toBe(7);
  });

  it('parses quantities like the API (positive, max 3 decimals) and builds unique keys', () => {
    expect(parseStockQuantity('2,5')).toBe(2.5);
    expect(parseStockQuantity('0.125')).toBe(0.125);
    expect(parseStockQuantity('0.1234')).toBeUndefined();
    expect(parseStockQuantity('0')).toBeUndefined();
    expect(parseStockQuantity('-1')).toBeUndefined();
    const a = newIdempotencyKey('web');
    expect(a).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    expect(newIdempotencyKey('web')).not.toBe(a);
  });
});

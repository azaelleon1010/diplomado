import { describe, it, expect } from 'vitest';
import {
  createCategory,
  createProduct,
  createWarehouse,
  deactivateCategory,
  deactivateProduct,
  deactivateWarehouse,
  getProduct,
  listProducts,
  updateProduct,
  type InventoryDeps,
} from '../../apps/api/src/modules/inventory/application/usecases';
import type {
  ICategoryStore,
  IProductStore,
  IWarehouseStore,
} from '../../apps/api/src/modules/inventory/domain/ports';
import type { IAuditSink } from '../../apps/api/src/modules/identity/domain/ports';
import type {
  InventoryCategory,
  Product,
  Warehouse,
} from '../../apps/api/src/modules/inventory/domain/entities';

function makeStores() {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const now = () => new Date();
  const categories = new Map<string, InventoryCategory>();
  const products = new Map<string, Product>();
  const warehouses = new Map<string, Warehouse>();
  const audits: unknown[] = [];

  const categoryStore: ICategoryStore = {
    findById: async (tenantId, cid) => {
      const c = categories.get(cid);
      return c && c.tenantId === tenantId ? c : null;
    },
    findByName: async (tenantId, name) =>
      [...categories.values()].find((c) => c.tenantId === tenantId && c.name === name) ?? null,
    list: async (tenantId, filters, page, limit) => {
      const data = [...categories.values()].filter(
        (c) =>
          c.tenantId === tenantId &&
          (!filters.status || c.status === filters.status) &&
          (!filters.search || c.name.toLowerCase().includes(filters.search.toLowerCase())),
      );
      return { data, total: data.length, page, limit, totalPages: 1 };
    },
    create: async (data) => {
      if ([...categories.values()].some((c) => c.tenantId === data.tenantId && c.name === data.name)) {
        throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      }
      const c: InventoryCategory = {
        _id: id('cat'), tenantId: data.tenantId, name: data.name, description: data.description,
        status: 'ACTIVE', createdAt: now(), updatedAt: now(), version: 1,
      };
      categories.set(c._id, c);
      return c;
    },
    update: async (tenantId, cid, patch, expectedVersion) => {
      const c = categories.get(cid);
      if (!c || c.tenantId !== tenantId) return null;
      if (c.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const next = { ...c, ...patch, version: c.version + 1, updatedAt: now() };
      categories.set(cid, next);
      return next;
    },
    countActiveProducts: async (tenantId, categoryId) =>
      [...products.values()].filter((p) => p.tenantId === tenantId && p.categoryId === categoryId && p.status === 'ACTIVE').length,
  };

  const productStore: IProductStore = {
    findById: async (tenantId, pid) => {
      const p = products.get(pid);
      return p && p.tenantId === tenantId ? p : null;
    },
    findBySku: async (tenantId, sku) =>
      [...products.values()].find((p) => p.tenantId === tenantId && p.sku === sku.toUpperCase()) ?? null,
    findByBarcode: async (tenantId, barcode) =>
      [...products.values()].find((p) => p.tenantId === tenantId && p.barcode === barcode) ?? null,
    list: async (tenantId, filters, page, limit) => {
      const data = [...products.values()].filter(
        (p) =>
          p.tenantId === tenantId &&
          (!filters.status || p.status === filters.status) &&
          (!filters.categoryId || p.categoryId === filters.categoryId),
      );
      return { data, total: data.length, page, limit, totalPages: 1 };
    },
    create: async (data) => {
      const p: Product = {
        _id: id('prd'), tenantId: data.tenantId, sku: data.sku.toUpperCase(), name: data.name,
        description: data.description, categoryId: data.categoryId, unit: data.unit,
        barcode: data.barcode, cost: data.cost, price: data.price,
        minimumStock: data.minimumStock, maximumStock: data.maximumStock,
        trackInventory: data.trackInventory, status: 'ACTIVE',
        createdAt: now(), updatedAt: now(), version: 1,
      };
      products.set(p._id, p);
      return p;
    },
    update: async (tenantId, pid, patch, expectedVersion, _updatedBy) => {
      const p = products.get(pid);
      if (!p || p.tenantId !== tenantId) return null;
      if (p.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const { description, categoryId, barcode, maximumStock, ...rest } = patch;
      const next: Product = { ...p, ...rest, version: p.version + 1, updatedAt: now() };
      if (description !== undefined) next.description = description ?? undefined;
      if (categoryId !== undefined) next.categoryId = categoryId ?? undefined;
      if (barcode !== undefined) next.barcode = barcode ?? undefined;
      if (maximumStock !== undefined) next.maximumStock = maximumStock ?? undefined;
      products.set(pid, next);
      return next;
    },
  };

  const warehouseStore: IWarehouseStore = {
    findById: async (tenantId, wid) => {
      const w = warehouses.get(wid);
      return w && w.tenantId === tenantId ? w : null;
    },
    findByCode: async (tenantId, code) =>
      [...warehouses.values()].find((w) => w.tenantId === tenantId && w.code === code.toUpperCase()) ?? null,
    list: async (tenantId, filters, page, limit) => {
      const data = [...warehouses.values()].filter(
        (w) => w.tenantId === tenantId && (!filters.status || w.status === filters.status),
      );
      return { data, total: data.length, page, limit, totalPages: 1 };
    },
    create: async (data) => {
      const w: Warehouse = {
        _id: id('wh'), tenantId: data.tenantId, code: data.code.toUpperCase(), name: data.name,
        description: data.description, address: data.address, status: 'ACTIVE',
        createdAt: now(), updatedAt: now(), version: 1,
      };
      warehouses.set(w._id, w);
      return w;
    },
    update: async (tenantId, wid, patch, expectedVersion) => {
      const w = warehouses.get(wid);
      if (!w || w.tenantId !== tenantId) return null;
      if (w.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const next = { ...w, ...patch, version: w.version + 1, updatedAt: now() };
      warehouses.set(wid, next);
      return next;
    },
  };

  const audit: IAuditSink = {
    record: async (event) => {
      audits.push(event);
    },
  };

  const deps: InventoryDeps = { categories: categoryStore, products: productStore, warehouses: warehouseStore, audit };
  const ctx = { userId: 'u-1', tenantId: 't-1' };
  return { deps, ctx, categories, products, warehouses, audits };
}

describe('inventory use cases (fake stores)', () => {
  it('creates category, product and warehouse with audit trail', async () => {
    const { deps, ctx, audits } = makeStores();
    const category = await createCategory(ctx, { name: 'Telas' }, deps);
    expect(category.tenantId).toBe('t-1');
    const warehouse = await createWarehouse(ctx, { code: 'ALM-01', name: 'Principal' }, deps);
    expect(warehouse.code).toBe('ALM-01');
    const product = await createProduct(
      ctx,
      { sku: 'tx-001', name: 'Tela', unit: 'm', cost: 10, price: 20, minimumStock: 5, categoryId: category._id },
      deps,
    );
    expect(product.sku).toBe('TX-001');
    expect(product.categoryId).toBe(category._id);
    expect(audits.length).toBe(3);
  });

  it('rejects duplicate category names and duplicate SKUs per tenant', async () => {
    const { deps, ctx } = makeStores();
    await createCategory(ctx, { name: 'Telas' }, deps);
    await expect(createCategory(ctx, { name: 'Telas' }, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    await createProduct(ctx, { sku: 'A-1', name: 'P1', unit: 'pza', cost: 1, price: 2, minimumStock: 0 }, deps);
    await expect(
      createProduct(ctx, { sku: 'a-1', name: 'P2', unit: 'pza', cost: 1, price: 2, minimumStock: 0 }, deps),
    ).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });

  it('allows the same SKU in different tenants and isolates reads', async () => {
    const { deps, ctx } = makeStores();
    const other = { userId: 'u-2', tenantId: 't-2' };
    await createProduct(ctx, { sku: 'SHARED', name: 'P1', unit: 'pza', cost: 1, price: 2, minimumStock: 0 }, deps);
    const same = await createProduct(other, { sku: 'shared', name: 'P2', unit: 'pza', cost: 1, price: 2, minimumStock: 0 }, deps);
    expect(same.tenantId).toBe('t-2');
    await expect(getProduct(other, 'prd-1', deps)).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    const listed = await listProducts(ctx, {}, 1, 20, 'createdAt', 'desc', deps);
    expect(listed.total).toBe(1);
  });

  it('validates stock bounds, category ownership and negative prices', async () => {
    const { deps, ctx } = makeStores();
    await expect(
      createProduct(ctx, { sku: 'B-1', name: 'P', unit: 'pza', cost: -1, price: 2, minimumStock: 0 }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    await expect(
      createProduct(ctx, { sku: 'B-2', name: 'P', unit: 'pza', cost: 1, price: 2, minimumStock: 10, maximumStock: 5 }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    await expect(
      createProduct(ctx, { sku: 'B-3', name: 'P', unit: 'pza', cost: 1, price: 2, minimumStock: 0, categoryId: 'nope' }, deps),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('blocks category deactivation while active products exist', async () => {
    const { deps, ctx } = makeStores();
    const category = await createCategory(ctx, { name: 'Telas' }, deps);
    const product = await createProduct(
      ctx,
      { sku: 'C-1', name: 'P', unit: 'pza', cost: 1, price: 2, minimumStock: 0, categoryId: category._id },
      deps,
    );
    await expect(deactivateCategory(ctx, category._id, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    await deactivateProduct(ctx, product._id, deps);
    const done = await deactivateCategory(ctx, category._id, deps);
    expect(done.status).toBe('INACTIVE');
  });

  it('clears description and category when the client sends null', async () => {
    const { deps, ctx } = makeStores();
    const category = await createCategory(ctx, { name: 'Telas' }, deps);
    const product = await createProduct(
      ctx,
      { sku: 'D-1', name: 'Producto', description: 'Texto', unit: 'pza', cost: 1, price: 2, minimumStock: 0, categoryId: category._id },
      deps,
    );
    const cleared = await updateProduct(
      ctx,
      product._id,
      { description: null, categoryId: null, expectedVersion: product.version },
      deps,
    );
    expect(cleared.description).toBeUndefined();
    expect(cleared.categoryId).toBeUndefined();
    expect(cleared.version).toBe(product.version + 1);
  });

  it('deactivates warehouses and exposes version conflicts on update', async () => {
    const { deps, ctx } = makeStores();
    const warehouse = await createWarehouse(ctx, { code: 'ALM-01', name: 'Principal' }, deps);
    const deactivated = await deactivateWarehouse(ctx, warehouse._id, deps);
    expect(deactivated.status).toBe('INACTIVE');
    await expect(
      updateProduct(ctx, warehouse._id, { name: 'X', expectedVersion: 999 }, deps),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });
});

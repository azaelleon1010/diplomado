import { describe, it, expect } from 'vitest';
import { buildMovementsReport, buildStockReport, resolveTenantName, type InventoryReportDeps, type TenantActor } from '../../apps/api/src/modules/inventory/application/reports';
import type { InventoryCategory, Product, Warehouse } from '../../apps/api/src/modules/inventory/domain/entities';
import type { StockBalance, StockMovement } from '../../apps/api/src/modules/inventory/domain/stock';

function paged<T>(data: T[]) {
  return { data, total: data.length, page: 1, limit: data.length || 1, totalPages: 1 };
}

function makeProduct(overrides: Partial<Product>): Product {
  return {
    _id: 'p1', tenantId: 'tnt_1', sku: 'SKU-1', name: 'Producto 1', unit: 'pza',
    cost: 10, price: 20, minimumStock: 0, trackInventory: true, status: 'ACTIVE',
    createdAt: new Date(), updatedAt: new Date(), version: 1,
    ...overrides,
  };
}

function makeWarehouse(overrides: Partial<Warehouse>): Warehouse {
  return { _id: 'w1', tenantId: 'tnt_1', code: 'ALM-1', name: 'Almacén 1', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), version: 1, ...overrides };
}

function makeCategory(overrides: Partial<InventoryCategory>): InventoryCategory {
  return { _id: 'c1', tenantId: 'tnt_1', name: 'Materias primas', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), version: 1, ...overrides };
}

function makeBalance(overrides: Partial<StockBalance>): StockBalance {
  return { _id: 'b1', tenantId: 'tnt_1', productId: 'p1', warehouseId: 'w1', quantity: 10, updatedAt: new Date('2026-01-10'), ...overrides };
}

function makeMovement(overrides: Partial<StockMovement>): StockMovement {
  return {
    _id: 'm1', tenantId: 'tnt_1', postingId: 'post-1', productId: 'p1', warehouseId: 'w1',
    type: 'RECEIPT', direction: 'IN', quantity: 5, balanceAfter: 10,
    source: { type: 'MANUAL', reference: 'REF-1' }, createdAt: new Date('2026-01-10'), createdBy: 'u1',
    ...overrides,
  };
}

const ctx: TenantActor = { tenantId: 'tnt_1', userId: 'u1' };

describe('buildStockReport', () => {
  it('joins balances with product/category/warehouse names and flags below-minimum products', async () => {
    const deps: InventoryReportDeps = {
      products: { list: async () => paged([makeProduct({ _id: 'p1', sku: 'SKU-1', name: 'Tornillo', categoryId: 'c1', minimumStock: 20 })]) },
      categories: { list: async () => paged([makeCategory({ _id: 'c1', name: 'Ferretería' })]) },
      warehouses: { list: async () => paged([makeWarehouse({ _id: 'w1', code: 'ALM-01', name: 'Central' })]) },
      ledger: {
        listBalances: async () => paged([makeBalance({ productId: 'p1', warehouseId: 'w1', quantity: 5 })]),
        listMovements: async () => paged([]),
      },
    };

    const result = await buildStockReport(ctx, {}, deps);

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0]!;
    expect(row).toMatchObject({ sku: 'SKU-1', productName: 'Tornillo', categoryName: 'Ferretería', warehouseCode: 'ALM-01', warehouseName: 'Central', quantity: 5, belowMinimum: true });
    expect(result.totalProducts).toBe(1);
    expect(result.belowMinimumCount).toBe(1);
  });

  it('compares against the total across every warehouse, not the single row quantity', async () => {
    const deps: InventoryReportDeps = {
      products: { list: async () => paged([makeProduct({ _id: 'p1', minimumStock: 12 })]) },
      categories: { list: async () => paged([]) },
      warehouses: { list: async () => paged([makeWarehouse({ _id: 'w1' }), makeWarehouse({ _id: 'w2', code: 'ALM-02', name: 'Secundario' })]) },
      ledger: {
        // 5 + 10 = 15 total, above the minimum of 12 — neither row should be flagged.
        listBalances: async () => paged([makeBalance({ warehouseId: 'w1', quantity: 5 }), makeBalance({ _id: 'b2', warehouseId: 'w2', quantity: 10 })]),
        listMovements: async () => paged([]),
      },
    };

    const result = await buildStockReport(ctx, {}, deps);
    expect(result.rows.every((r) => !r.belowMinimum)).toBe(true);
  });

  it('skips balances whose product was filtered out (e.g. by categoryId)', async () => {
    const deps: InventoryReportDeps = {
      products: { list: async () => paged([]) }, // categoryId filter excluded the product
      categories: { list: async () => paged([]) },
      warehouses: { list: async () => paged([makeWarehouse({})]) },
      ledger: {
        listBalances: async () => paged([makeBalance({})]),
        listMovements: async () => paged([]),
      },
    };

    const result = await buildStockReport(ctx, { categoryId: 'other' }, deps);
    expect(result.rows).toHaveLength(0);
  });

  it('resolves generatedBy from the user store when provided', async () => {
    const deps: InventoryReportDeps = {
      products: { list: async () => paged([]) },
      categories: { list: async () => paged([]) },
      warehouses: { list: async () => paged([]) },
      ledger: { listBalances: async () => paged([]), listMovements: async () => paged([]) },
      users: { findById: async () => ({ username: 'ana.perez' }) },
    };

    const result = await buildStockReport(ctx, {}, deps);
    expect(result.generatedBy).toBe('ana.perez');
  });

  it('falls back to the user id when no user store is provided', async () => {
    const deps: InventoryReportDeps = {
      products: { list: async () => paged([]) },
      categories: { list: async () => paged([]) },
      warehouses: { list: async () => paged([]) },
      ledger: { listBalances: async () => paged([]), listMovements: async () => paged([]) },
    };

    const result = await buildStockReport(ctx, {}, deps);
    expect(result.generatedBy).toBe('u1');
  });
});

describe('buildMovementsReport', () => {
  it('enriches movements with product and warehouse labels', async () => {
    const deps: InventoryReportDeps = {
      products: { list: async () => paged([makeProduct({ _id: 'p1', sku: 'SKU-9', name: 'Placa' })]) },
      categories: { list: async () => paged([]) },
      warehouses: { list: async () => paged([makeWarehouse({ _id: 'w1', code: 'ALM-09', name: 'Taller' })]) },
      ledger: {
        listBalances: async () => paged([]),
        listMovements: async () => paged([makeMovement({ type: 'ISSUE', direction: 'OUT', quantity: 3, balanceAfter: 7 })]),
      },
    };

    const result = await buildMovementsReport(ctx, {}, deps);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ productSku: 'SKU-9', productName: 'Placa', warehouseCode: 'ALM-09', direction: 'OUT', quantity: 3, balanceAfter: 7, reference: 'REF-1' });
  });

  it('shows a dash when the product or warehouse reference is missing', async () => {
    const deps: InventoryReportDeps = {
      products: { list: async () => paged([]) },
      categories: { list: async () => paged([]) },
      warehouses: { list: async () => paged([]) },
      ledger: { listBalances: async () => paged([]), listMovements: async () => paged([makeMovement({ source: { type: 'MANUAL' } })]) },
    };

    const result = await buildMovementsReport(ctx, {}, deps);
    expect(result.rows[0]).toMatchObject({ productName: 'Producto no disponible', warehouseName: 'Almacén no disponible', reference: '—' });
  });
});

describe('resolveTenantName', () => {
  it('uses the tenant store when provided', async () => {
    const name = await resolveTenantName(ctx, { tenants: { findById: async () => ({ name: 'Acme Textil' }) } });
    expect(name).toBe('Acme Textil');
  });

  it('falls back to the tenant id otherwise', async () => {
    const name = await resolveTenantName(ctx, {});
    expect(name).toBe('tnt_1');
  });
});

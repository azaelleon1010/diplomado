/**
 * Inventory report use cases.
 *
 * Reuse the exact same queries the screens use (listStockBalances /
 * listStockMovements) and the same catalog stores — a report must never
 * show different data than the list it summarizes. Permissions are
 * enforced by the route guard (inventory.read), same as the list endpoints.
 */
import type { ICategoryStore, IProductStore, IWarehouseStore } from '../domain/ports';
import type { IStockLedger, StockBalanceFilters, StockMovementFilters } from '../domain/stock';

export interface TenantActor {
  tenantId: string;
  userId: string;
}

/** Rows beyond this are truncated; keeps a single report request bounded. */
export const REPORT_MAX_ROWS = 10_000;

export interface ReportUserLookup {
  findById(tenantId: string, id: string): Promise<{ username: string } | null>;
}

export interface ReportTenantLookup {
  findById(tenantId: string): Promise<{ name: string } | null>;
}

export interface InventoryReportDeps {
  products: Pick<IProductStore, 'list'>;
  categories: Pick<ICategoryStore, 'list'>;
  warehouses: Pick<IWarehouseStore, 'list'>;
  ledger: Pick<IStockLedger, 'listBalances' | 'listMovements'>;
  users?: ReportUserLookup;
  tenants?: ReportTenantLookup;
}

async function resolveGeneratedBy(ctx: TenantActor, deps: Pick<InventoryReportDeps, 'users'>): Promise<string> {
  if (!deps.users) return ctx.userId;
  const user = await deps.users.findById(ctx.tenantId, ctx.userId).catch(() => null);
  return user?.username ?? ctx.userId;
}

export async function resolveTenantName(ctx: TenantActor, deps: Pick<InventoryReportDeps, 'tenants'>): Promise<string> {
  if (!deps.tenants) return ctx.tenantId;
  const tenant = await deps.tenants.findById(ctx.tenantId).catch(() => null);
  return tenant?.name ?? ctx.tenantId;
}

export interface StockReportFilters {
  warehouseId?: string;
  categoryId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  nonZero?: boolean;
}

export interface StockReportRow {
  sku: string;
  productName: string;
  categoryName: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  unit: string;
  minimumStock: number;
  maximumStock?: number;
  belowMinimum: boolean;
  updatedAt: Date;
}

export interface StockReportResult {
  generatedBy: string;
  rows: StockReportRow[];
  totalProducts: number;
  belowMinimumCount: number;
}

/** Full stock report: one row per product+warehouse balance, enriched with catalog names. */
export async function buildStockReport(ctx: TenantActor, filters: StockReportFilters, deps: InventoryReportDeps): Promise<StockReportResult> {
  const [generatedBy, productPage, categoryPage, warehousePage, balancePage] = await Promise.all([
    resolveGeneratedBy(ctx, deps),
    deps.products.list(ctx.tenantId, { categoryId: filters.categoryId, status: filters.status }, 1, REPORT_MAX_ROWS),
    deps.categories.list(ctx.tenantId, {}, 1, REPORT_MAX_ROWS),
    deps.warehouses.list(ctx.tenantId, {}, 1, REPORT_MAX_ROWS),
    deps.ledger.listBalances(
      ctx.tenantId,
      { warehouseId: filters.warehouseId, nonZero: filters.nonZero ?? true } satisfies StockBalanceFilters,
      1,
      REPORT_MAX_ROWS,
    ),
  ]);

  const productById = new Map(productPage.data.map((p) => [p._id, p]));
  const categoryById = new Map(categoryPage.data.map((c) => [c._id, c]));
  const warehouseById = new Map(warehousePage.data.map((w) => [w._id, w]));

  // Minimum-stock comparisons use the product's total across every warehouse,
  // same rule the Web/Mobile screens already apply — never per-warehouse.
  const totalsByProduct = new Map<string, number>();
  for (const balance of balancePage.data) {
    totalsByProduct.set(balance.productId, (totalsByProduct.get(balance.productId) ?? 0) + balance.quantity);
  }

  const rows: StockReportRow[] = [];
  for (const balance of balancePage.data) {
    const product = productById.get(balance.productId);
    if (!product) continue; // filtered out by categoryId/status, or inconsistent reference
    const warehouse = warehouseById.get(balance.warehouseId);
    const total = totalsByProduct.get(balance.productId) ?? balance.quantity;
    rows.push({
      sku: product.sku,
      productName: product.name,
      categoryName: product.categoryId ? categoryById.get(product.categoryId)?.name ?? '—' : '—',
      warehouseCode: warehouse?.code ?? '—',
      warehouseName: warehouse?.name ?? 'Almacén no disponible',
      quantity: balance.quantity,
      unit: product.unit,
      minimumStock: product.minimumStock,
      maximumStock: product.maximumStock,
      belowMinimum: product.minimumStock > 0 && total < product.minimumStock,
      updatedAt: balance.updatedAt,
    });
  }

  rows.sort((a, b) => a.sku.localeCompare(b.sku) || a.warehouseCode.localeCompare(b.warehouseCode));

  return {
    generatedBy,
    rows,
    totalProducts: new Set(rows.map((r) => r.sku)).size,
    belowMinimumCount: new Set(rows.filter((r) => r.belowMinimum).map((r) => r.sku)).size,
  };
}

export interface MovementsReportFilters {
  productId?: string;
  warehouseId?: string;
  type?: StockMovementFilters['type'];
  sourceType?: StockMovementFilters['sourceType'];
}

export interface MovementsReportRow {
  date: Date;
  type: string;
  direction: 'IN' | 'OUT';
  productSku: string;
  productName: string;
  warehouseCode: string;
  warehouseName: string;
  quantity: number;
  balanceAfter: number;
  sourceType: string;
  reference: string;
}

export interface MovementsReportResult {
  generatedBy: string;
  rows: MovementsReportRow[];
}

/** Movement history report: the same immutable ledger entries the Stock screen lists. */
export async function buildMovementsReport(ctx: TenantActor, filters: MovementsReportFilters, deps: InventoryReportDeps): Promise<MovementsReportResult> {
  const [generatedBy, productPage, warehousePage, movementPage] = await Promise.all([
    resolveGeneratedBy(ctx, deps),
    deps.products.list(ctx.tenantId, {}, 1, REPORT_MAX_ROWS),
    deps.warehouses.list(ctx.tenantId, {}, 1, REPORT_MAX_ROWS),
    deps.ledger.listMovements(
      ctx.tenantId,
      { productId: filters.productId, warehouseId: filters.warehouseId, type: filters.type, sourceType: filters.sourceType } satisfies StockMovementFilters,
      1,
      REPORT_MAX_ROWS,
    ),
  ]);

  const productById = new Map(productPage.data.map((p) => [p._id, p]));
  const warehouseById = new Map(warehousePage.data.map((w) => [w._id, w]));

  const rows: MovementsReportRow[] = movementPage.data.map((m) => {
    const product = productById.get(m.productId);
    const warehouse = warehouseById.get(m.warehouseId);
    return {
      date: m.createdAt,
      type: m.type,
      direction: m.direction,
      productSku: product?.sku ?? '—',
      productName: product?.name ?? 'Producto no disponible',
      warehouseCode: warehouse?.code ?? '—',
      warehouseName: warehouse?.name ?? 'Almacén no disponible',
      quantity: m.quantity,
      balanceAfter: m.balanceAfter,
      sourceType: m.source.type,
      reference: m.source.reference ?? '—',
    };
  });

  return { generatedBy, rows };
}

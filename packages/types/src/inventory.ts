/**
 * Shared inventory contract for the Web and Mobile clients.
 *
 * Both clients talk to the same API (/api/v1/inventory) and MongoDB tenant
 * data, so request shapes, validation and endpoints live here once. Rules
 * mirror apps/api/src/modules/inventory/presentation/schemas.ts; the backend
 * remains the final authority (tenant comes from the access token, never
 * from these payloads).
 */

export type InventoryStatus = 'ACTIVE' | 'INACTIVE';

export interface InventoryProduct {
  _id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  unit: string;
  barcode?: string;
  cost: number;
  price: number;
  minimumStock: number;
  maximumStock?: number;
  trackInventory: boolean;
  status: InventoryStatus;
  createdAt: string;
  updatedAt: string;
  /** Optimistic concurrency token; send it back as expectedVersion. */
  version: number;
}

export interface InventoryCategory {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: InventoryStatus;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

/** Body for POST /api/v1/inventory/products. */
export interface CreateProductPayload {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  unit: string;
  barcode?: string;
  cost: number;
  price: number;
  minimumStock: number;
  maximumStock?: number;
  trackInventory: boolean;
}

/** Body for PATCH /api/v1/inventory/products/:id. `null` clears an optional field. */
export interface UpdateProductPayload {
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  unit: string;
  barcode: string | null;
  cost: number;
  price: number;
  minimumStock: number;
  maximumStock: number | null;
  trackInventory: boolean;
  expectedVersion: number;
}

export interface ProductPage {
  items: InventoryProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListProductsParams {
  search?: string;
  categoryId?: string;
  status?: InventoryStatus;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Form values (raw text from inputs) -> validated payloads
// ---------------------------------------------------------------------------

export interface ProductFormValues {
  sku: string;
  name: string;
  description: string;
  categoryId: string;
  unit: string;
  barcode: string;
  cost: string;
  price: string;
  minimumStock: string;
  maximumStock: string;
  trackInventory: boolean;
}

export const DEFAULT_PRODUCT_UNIT = 'PZA';

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  sku: '',
  name: '',
  description: '',
  categoryId: '',
  unit: DEFAULT_PRODUCT_UNIT,
  barcode: '',
  cost: '0',
  price: '0',
  minimumStock: '0',
  maximumStock: '',
  trackInventory: true,
};

export function productToFormValues(product: InventoryProduct): ProductFormValues {
  return {
    sku: product.sku ?? '',
    name: product.name ?? '',
    description: product.description ?? '',
    categoryId: product.categoryId ?? '',
    unit: product.unit ?? DEFAULT_PRODUCT_UNIT,
    barcode: product.barcode ?? '',
    cost: String(product.cost ?? 0),
    price: String(product.price ?? 0),
    minimumStock: String(product.minimumStock ?? 0),
    maximumStock: product.maximumStock === undefined || product.maximumStock === null ? '' : String(product.maximumStock),
    trackInventory: Boolean(product.trackInventory),
  };
}

/** Normalized product fields; optional text fields are undefined when empty. */
export interface ProductFields {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  unit: string;
  barcode?: string;
  cost: number;
  price: number;
  minimumStock: number;
  maximumStock?: number;
  trackInventory: boolean;
}

export type ProductFormResult =
  | { ok: true; fields: ProductFields }
  | { ok: false; field: keyof ProductFormValues; error: string };

const MAX_AMOUNT = 1_000_000_000;

/** Accepts "12", "12.5" and "12,5" (Android decimal keyboards in es-MX). */
function parseAmount(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^\d+(?:[.,]\d+)?$/.test(text)) return undefined;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value <= MAX_AMOUNT ? value : undefined;
}

function parseCount(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) && value <= MAX_AMOUNT ? value : undefined;
}

function fail(field: keyof ProductFormValues, error: string): ProductFormResult {
  return { ok: false, field, error };
}

/** Same limits as createProductSchema/updateProductSchema in the API. */
export function validateProductForm(values: ProductFormValues): ProductFormResult {
  const sku = values.sku.trim();
  const name = values.name.trim();
  const description = values.description.trim();
  const unit = values.unit.trim() || DEFAULT_PRODUCT_UNIT;
  const barcode = values.barcode.trim();

  if (!sku) return fail('sku', 'El SKU es obligatorio.');
  if (sku.length > 64) return fail('sku', 'El SKU admite como máximo 64 caracteres.');
  if (!name) return fail('name', 'El nombre del producto es obligatorio.');
  if (name.length < 2 || name.length > 200) return fail('name', 'El nombre debe tener entre 2 y 200 caracteres.');
  if (description.length > 1000) return fail('description', 'La descripción admite como máximo 1000 caracteres.');
  if (unit.length > 20) return fail('unit', 'La unidad admite como máximo 20 caracteres.');
  if (barcode.length > 64) return fail('barcode', 'El código de barras admite como máximo 64 caracteres.');

  const cost = parseAmount(values.cost);
  if (cost === undefined) return fail('cost', 'El costo debe ser un número válido mayor o igual a 0.');
  const price = parseAmount(values.price);
  if (price === undefined) return fail('price', 'El precio debe ser un número válido mayor o igual a 0.');

  const minimumStock = values.minimumStock.trim() === '' ? 0 : parseCount(values.minimumStock);
  if (minimumStock === undefined) return fail('minimumStock', 'El stock mínimo debe ser un número entero mayor o igual a 0.');

  let maximumStock: number | undefined;
  if (values.maximumStock.trim() !== '') {
    maximumStock = parseCount(values.maximumStock);
    if (maximumStock === undefined) return fail('maximumStock', 'El stock máximo debe ser un número entero mayor o igual a 0.');
    if (maximumStock < minimumStock) return fail('maximumStock', 'El stock máximo no puede ser menor que el stock mínimo.');
  }

  return {
    ok: true,
    fields: {
      sku,
      name,
      description: description || undefined,
      categoryId: values.categoryId.trim() || undefined,
      unit,
      barcode: barcode || undefined,
      cost,
      price,
      minimumStock,
      maximumStock,
      trackInventory: values.trackInventory,
    },
  };
}

export function toCreateProductPayload(fields: ProductFields): CreateProductPayload {
  return {
    sku: fields.sku,
    name: fields.name,
    unit: fields.unit,
    cost: fields.cost,
    price: fields.price,
    minimumStock: fields.minimumStock,
    trackInventory: fields.trackInventory,
    ...(fields.description !== undefined ? { description: fields.description } : {}),
    ...(fields.categoryId !== undefined ? { categoryId: fields.categoryId } : {}),
    ...(fields.barcode !== undefined ? { barcode: fields.barcode } : {}),
    ...(fields.maximumStock !== undefined ? { maximumStock: fields.maximumStock } : {}),
  };
}

/** Full replacement of the editable fields; emptied optionals are cleared with null. */
export function toUpdateProductPayload(fields: ProductFields, expectedVersion: number): UpdateProductPayload {
  return {
    sku: fields.sku,
    name: fields.name,
    description: fields.description ?? null,
    categoryId: fields.categoryId ?? null,
    unit: fields.unit,
    barcode: fields.barcode ?? null,
    cost: fields.cost,
    price: fields.price,
    minimumStock: fields.minimumStock,
    maximumStock: fields.maximumStock ?? null,
    trackInventory: fields.trackInventory,
    expectedVersion,
  };
}

/** The API answers 409 VERSION_CONFLICT when another client saved first. */
export function isVersionConflict(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'VERSION_CONFLICT');
}

export const VERSION_CONFLICT_MESSAGE =
  'Otro usuario o dispositivo modificó este producto. Se cargaron los datos más recientes; revisa y vuelve a guardar.';

// ---------------------------------------------------------------------------
// HTTP client (transport is injected by each app: fetch + its session store)
// ---------------------------------------------------------------------------

export interface InventoryRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token: string;
  body?: unknown;
}

export interface InventoryRequestClient {
  request<T>(path: string, options: InventoryRequestOptions): Promise<T>;
  page<T>(path: string, options: InventoryRequestOptions): Promise<{ data: T; meta?: Record<string, unknown> }>;
}

const BASE = '/api/v1/inventory';

function query(params: Record<string, string | number | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

function metaNumber(meta: Record<string, unknown> | undefined, key: string, fallback: number): number {
  const value = meta?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function createInventoryApi(client: InventoryRequestClient) {
  async function listProductsPage(token: string, params: ListProductsParams = {}): Promise<ProductPage> {
    const page = params.page ?? 1;
    const limit = params.limit ?? 100;
    const result = await client.page<InventoryProduct[]>(
      `${BASE}/products${query({
        search: params.search?.trim(),
        categoryId: params.categoryId,
        status: params.status,
        page,
        limit,
      })}`,
      { token },
    );
    const items = Array.isArray(result.data) ? result.data : [];
    return {
      items,
      total: metaNumber(result.meta, 'total', items.length),
      page: metaNumber(result.meta, 'page', page),
      limit: metaNumber(result.meta, 'limit', limit),
      totalPages: metaNumber(result.meta, 'totalPages', 1),
    };
  }

  return {
    listProductsPage,

    async listProducts(token: string, params: ListProductsParams = {}): Promise<InventoryProduct[]> {
      return (await listProductsPage(token, params)).items;
    },

    getProduct(token: string, productId: string): Promise<InventoryProduct> {
      return client.request<InventoryProduct>(`${BASE}/products/${encodeURIComponent(productId)}`, { token });
    },

    async listCategories(token: string): Promise<InventoryCategory[]> {
      const result = await client.page<InventoryCategory[]>(`${BASE}/categories${query({ page: 1, limit: 100 })}`, { token });
      return Array.isArray(result.data) ? result.data : [];
    },

    createProduct(token: string, payload: CreateProductPayload): Promise<InventoryProduct> {
      return client.request<InventoryProduct>(`${BASE}/products`, { method: 'POST', token, body: payload });
    },

    updateProduct(token: string, productId: string, payload: UpdateProductPayload): Promise<InventoryProduct> {
      return client.request<InventoryProduct>(`${BASE}/products/${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        token,
        body: payload,
      });
    },

    /** Logical delete: the API marks the product INACTIVE and audits it (inventory.delete). */
    deactivateProduct(token: string, productId: string): Promise<InventoryProduct> {
      return client.request<InventoryProduct>(`${BASE}/products/${encodeURIComponent(productId)}`, { method: 'DELETE', token });
    },

    activateProduct(token: string, productId: string, expectedVersion: number): Promise<InventoryProduct> {
      return client.request<InventoryProduct>(`${BASE}/products/${encodeURIComponent(productId)}`, {
        method: 'PATCH',
        token,
        body: { status: 'ACTIVE', expectedVersion },
      });
    },
  };
}

export type InventoryApi = ReturnType<typeof createInventoryApi>;

// ---------------------------------------------------------------------------
// Warehouses and stock ledger (balances, movements, transfers)
// ---------------------------------------------------------------------------

export interface InventoryWarehouse {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  address?: string;
  status: InventoryStatus;
  createdAt?: string;
  updatedAt?: string;
  version: number;
}

export interface CreateWarehousePayload {
  code: string;
  name: string;
  description?: string;
  address?: string;
}

export type StockMovementType = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
export type ManualStockMovementType = 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

export const STOCK_MOVEMENT_LABELS: Readonly<Record<StockMovementType, string>> = {
  RECEIPT: 'Entrada',
  ISSUE: 'Salida',
  ADJUSTMENT_IN: 'Ajuste (+)',
  ADJUSTMENT_OUT: 'Ajuste (−)',
  TRANSFER_IN: 'Transferencia (entrada)',
  TRANSFER_OUT: 'Transferencia (salida)',
};

/** Permission the API requires for each manual movement type. */
export const STOCK_MOVEMENT_PERMISSION: Readonly<Record<ManualStockMovementType, string>> = {
  RECEIPT: 'inventory.stock.in',
  ISSUE: 'inventory.stock.out',
  ADJUSTMENT_IN: 'inventory.stock.adjust',
  ADJUSTMENT_OUT: 'inventory.stock.adjust',
};

export interface StockBalanceView {
  _id: string;
  tenantId: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  updatedAt: string;
}

export interface StockMovementView {
  _id: string;
  tenantId: string;
  postingId: string;
  productId: string;
  warehouseId: string;
  type: StockMovementType;
  direction: 'IN' | 'OUT';
  quantity: number;
  unitCost?: number;
  balanceAfter: number;
  source: { type: string; id?: string; reference?: string };
  notes?: string;
  createdAt: string;
  createdBy: string;
}

export interface PostStockMovementsPayload {
  lines: Array<{ productId: string; warehouseId: string; type: ManualStockMovementType; quantity: number; unitCost?: number }>;
  reference?: string;
  notes?: string;
  idempotencyKey: string;
}

export interface TransferStockPayload {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reference?: string;
  notes?: string;
  idempotencyKey: string;
}

export interface StockPostingResult {
  postingId: string;
  movements: StockMovementView[];
  replayed: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * One key per user action (create it when the form opens / before the
 * first submit and reuse it on retries). Not a secret: uniqueness only.
 */
export function newIdempotencyKey(prefix = 'op'): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

/** Same rule as the API: positive, at most 3 decimals; accepts "1,5". */
export function parseStockQuantity(raw: string): number | undefined {
  const text = raw.trim();
  if (!/^\d+(?:[.,]\d{1,3})?$/.test(text)) return undefined;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value > 0 && value <= 1_000_000_000 ? value : undefined;
}

export function formatQuantity(value: number): string {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 3 });
}

export function createStockApi(client: InventoryRequestClient) {
  async function page<T>(path: string, token: string): Promise<Page<T>> {
    const result = await client.page<T[]>(path, { token });
    const items = Array.isArray(result.data) ? result.data : [];
    return {
      items,
      total: metaNumber(result.meta, 'total', items.length),
      page: metaNumber(result.meta, 'page', 1),
      limit: metaNumber(result.meta, 'limit', items.length),
      totalPages: metaNumber(result.meta, 'totalPages', 1),
    };
  }

  return {
    listWarehouses(token: string): Promise<Page<InventoryWarehouse>> {
      return page<InventoryWarehouse>(`${BASE}/warehouses${query({ page: 1, limit: 100 })}`, token);
    },

    createWarehouse(token: string, payload: CreateWarehousePayload): Promise<InventoryWarehouse> {
      return client.request<InventoryWarehouse>(`${BASE}/warehouses`, { method: 'POST', token, body: payload });
    },

    deactivateWarehouse(token: string, warehouseId: string): Promise<InventoryWarehouse> {
      return client.request<InventoryWarehouse>(`${BASE}/warehouses/${encodeURIComponent(warehouseId)}`, { method: 'DELETE', token });
    },

    listStock(token: string, params: { productId?: string; warehouseId?: string; nonZero?: boolean; page?: number; limit?: number } = {}): Promise<Page<StockBalanceView>> {
      return page<StockBalanceView>(
        `${BASE}/stock${query({
          productId: params.productId,
          warehouseId: params.warehouseId,
          nonZero: params.nonZero ? 'true' : undefined,
          page: params.page ?? 1,
          limit: params.limit ?? 100,
        })}`,
        token,
      );
    },

    listMovements(token: string, params: { productId?: string; warehouseId?: string; type?: StockMovementType; page?: number; limit?: number } = {}): Promise<Page<StockMovementView>> {
      return page<StockMovementView>(
        `${BASE}/movements${query({
          productId: params.productId,
          warehouseId: params.warehouseId,
          type: params.type,
          page: params.page ?? 1,
          limit: params.limit ?? 50,
        })}`,
        token,
      );
    },

    postMovements(token: string, payload: PostStockMovementsPayload): Promise<StockPostingResult> {
      return client.request<StockPostingResult>(`${BASE}/movements`, { method: 'POST', token, body: payload });
    },

    transfer(token: string, payload: TransferStockPayload): Promise<StockPostingResult> {
      return client.request<StockPostingResult>(`${BASE}/transfers`, { method: 'POST', token, body: payload });
    },
  };
}

export type StockApi = ReturnType<typeof createStockApi>;

/**
 * Spanish message for ledger business errors (API messages are technical
 * English). Returns null for errors the caller should describe itself.
 */
export function describeStockError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { code, fields } = error as { code?: unknown; fields?: Record<string, unknown> };
  if (code === 'INSUFFICIENT_STOCK') {
    const available = typeof fields?.available === 'number' ? formatQuantity(fields.available) : '0';
    const requested = typeof fields?.requested === 'number' ? formatQuantity(fields.requested) : '';
    return `Existencia insuficiente: disponible ${available}${requested ? `, solicitado ${requested}` : ''}. No se registró ningún movimiento.`;
  }
  if (code === 'IDEMPOTENCY_CONFLICT') {
    return 'Esta operación ya se había enviado con otros datos. Revisa los movimientos antes de reintentar.';
  }
  return null;
}

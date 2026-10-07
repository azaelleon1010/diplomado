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

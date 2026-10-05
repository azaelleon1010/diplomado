/**
 * Inventory use cases — orchestrate ports, enforce business rules.
 * No Express, no Mongoose here.
 */
import { AppError } from '@erp/errors';
import { sanitizeForAudit } from '../../identity/domain/entities';
import type { IAuditSink } from '../../identity/domain/ports';
import type { AuditResult } from '../../identity/domain/entities';
import { INVENTORY_ACTIONS, type InventoryStatus } from '../domain/entities';
import type {
  CategoryFilters,
  CreateProductData,
  ICategoryStore,
  IProductStore,
  IWarehouseStore,
  ProductFilters,
  UpdateProductData,
  WarehouseFilters,
} from '../domain/ports';

export interface InventoryDeps {
  categories: ICategoryStore;
  products: IProductStore;
  warehouses: IWarehouseStore;
  audit: IAuditSink;
}

export interface InventoryActor {
  userId: string;
  tenantId: string;
  correlationId?: string;
}

async function audit(deps: InventoryDeps, event: { tenantId: string; userId?: string; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; result: AuditResult; correlationId?: string }) {
  await deps.audit.record({
    tenantId: event.tenantId,
    userId: event.userId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    before: sanitizeForAudit(event.before),
    after: sanitizeForAudit(event.after),
    result: event.result,
    correlationId: event.correlationId,
  });
}

function notFound(entity: string): AppError {
  return new AppError({ code: 'NOT_FOUND', message: `${entity} not found`, statusCode: 404 });
}

function duplicate(field: string): AppError {
  return new AppError({ code: 'CONFLICT', message: `Duplicate value for ${field}`, statusCode: 409, fields: { duplicateFields: { [field]: true } } });
}

async function assertCategoryUsable(deps: InventoryDeps, tenantId: string, categoryId: string): Promise<void> {
  const category = await deps.categories.findById(tenantId, categoryId);
  if (!category) throw notFound('Category');
  if (category.status !== 'ACTIVE') {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'Category is not active', statusCode: 400 });
  }
}

function assertStockBounds(minimumStock: number, maximumStock?: number): void {
  if (minimumStock < 0) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'minimumStock cannot be negative', statusCode: 400 });
  }
  if (maximumStock !== undefined && maximumStock < minimumStock) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'maximumStock cannot be less than minimumStock', statusCode: 400 });
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export interface CreateCategoryInput {
  name: string;
  description?: string;
}

export async function createCategory(ctx: InventoryActor, input: CreateCategoryInput, deps: InventoryDeps) {
  const name = input.name.trim();
  const existing = await deps.categories.findByName(ctx.tenantId, name);
  if (existing) throw duplicate('name');
  const created = await deps.categories.create({
    tenantId: ctx.tenantId,
    name,
    description: input.description?.trim() || undefined,
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: INVENTORY_ACTIONS.CATEGORY_CREATED,
    entityType: 'category',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { name: created.name },
  });
  return created;
}

export async function getCategory(ctx: InventoryActor, id: string, deps: InventoryDeps) {
  const category = await deps.categories.findById(ctx.tenantId, id);
  if (!category) throw notFound('Category');
  return category;
}

export async function listCategories(ctx: InventoryActor, filters: CategoryFilters, page: number, limit: number, deps: InventoryDeps) {
  return deps.categories.list(ctx.tenantId, filters, page, limit);
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  status?: InventoryStatus;
  expectedVersion: number;
}

export async function updateCategory(ctx: InventoryActor, id: string, input: UpdateCategoryInput, deps: InventoryDeps) {
  const patch: { name?: string; description?: string; status?: InventoryStatus } = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim() || undefined;
  if (input.status !== undefined) patch.status = input.status;
  const before = await deps.categories.findById(ctx.tenantId, id);
  if (!before) throw notFound('Category');
  if (patch.name && patch.name !== before.name) {
    const clash = await deps.categories.findByName(ctx.tenantId, patch.name);
    if (clash) throw duplicate('name');
  }
  const updated = await deps.categories.update(ctx.tenantId, id, patch, input.expectedVersion, ctx.userId);
  if (!updated) throw notFound('Category');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: INVENTORY_ACTIONS.CATEGORY_UPDATED,
    entityType: 'category',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { name: before.name, status: before.status },
    after: { name: updated.name, status: updated.status },
  });
  return updated;
}

export async function deactivateCategory(ctx: InventoryActor, id: string, deps: InventoryDeps) {
  const category = await deps.categories.findById(ctx.tenantId, id);
  if (!category) throw notFound('Category');
  const linked = await deps.categories.countActiveProducts(ctx.tenantId, id);
  if (linked > 0) {
    throw new AppError({
      code: 'CONFLICT',
      message: `Category has ${linked} active product(s) and cannot be deactivated`,
      statusCode: 409,
      fields: { activeProducts: linked },
    });
  }
  const updated = await deps.categories.update(ctx.tenantId, id, { status: 'INACTIVE' }, category.version, ctx.userId);
  if (!updated) throw notFound('Category');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: INVENTORY_ACTIONS.CATEGORY_DEACTIVATED,
    entityType: 'category',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: category.status },
    after: { status: updated.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export interface CreateProductInput {
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
  trackInventory?: boolean;
}

export async function createProduct(ctx: InventoryActor, input: CreateProductInput, deps: InventoryDeps) {
  const sku = input.sku.trim().toUpperCase();
  const existing = await deps.products.findBySku(ctx.tenantId, sku);
  if (existing) throw duplicate('sku');
  const barcode = input.barcode?.trim() ? input.barcode.trim() : undefined;
  if (barcode) {
    const clash = await deps.products.findByBarcode(ctx.tenantId, barcode);
    if (clash) throw duplicate('barcode');
  }
  if (input.categoryId) await assertCategoryUsable(deps, ctx.tenantId, input.categoryId);
  if (input.cost < 0) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'cost cannot be negative', statusCode: 400 });
  }
  if (input.price < 0) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'price cannot be negative', statusCode: 400 });
  }
  assertStockBounds(input.minimumStock, input.maximumStock);
  const created = await deps.products.create({
    tenantId: ctx.tenantId,
    sku,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    categoryId: input.categoryId,
    unit: input.unit.trim(),
    barcode,
    cost: input.cost,
    price: input.price,
    minimumStock: input.minimumStock,
    maximumStock: input.maximumStock,
    trackInventory: input.trackInventory ?? true,
    createdBy: ctx.userId,
  } satisfies CreateProductData);
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: INVENTORY_ACTIONS.PRODUCT_CREATED,
    entityType: 'product',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { sku: created.sku, name: created.name },
  });
  return created;
}

export async function getProduct(ctx: InventoryActor, id: string, deps: InventoryDeps) {
  const product = await deps.products.findById(ctx.tenantId, id);
  if (!product) throw notFound('Product');
  return product;
}

export async function listProducts(ctx: InventoryActor, filters: ProductFilters, page: number, limit: number, sortBy: string, sortOrder: 'asc' | 'desc', deps: InventoryDeps) {
  if (filters.categoryId) await assertCategoryUsable(deps, ctx.tenantId, filters.categoryId);
  return deps.products.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
}

export interface UpdateProductInput extends UpdateProductData {
  expectedVersion: number;
}

export async function updateProduct(ctx: InventoryActor, id: string, input: UpdateProductInput, deps: InventoryDeps) {
  const before = await deps.products.findById(ctx.tenantId, id);
  if (!before) throw notFound('Product');
  const { expectedVersion, ...fields } = input;
  const patch: UpdateProductData = {};
  if (fields.name !== undefined) patch.name = fields.name.trim();
  if (fields.description !== undefined) patch.description = fields.description?.trim() || undefined;
  if (fields.categoryId !== undefined) {
    if (fields.categoryId !== null) await assertCategoryUsable(deps, ctx.tenantId, fields.categoryId);
    patch.categoryId = fields.categoryId ?? undefined;
  }
  if (fields.unit !== undefined) patch.unit = fields.unit.trim();
  if (fields.barcode !== undefined) patch.barcode = fields.barcode?.trim() ? fields.barcode.trim() : null;
  if (fields.cost !== undefined) {
    if (fields.cost < 0) throw new AppError({ code: 'VALIDATION_ERROR', message: 'cost cannot be negative', statusCode: 400 });
    patch.cost = fields.cost;
  }
  if (fields.price !== undefined) {
    if (fields.price < 0) throw new AppError({ code: 'VALIDATION_ERROR', message: 'price cannot be negative', statusCode: 400 });
    patch.price = fields.price;
  }
  const minimumStock = fields.minimumStock ?? before.minimumStock;
  const maximumStock = fields.maximumStock !== undefined ? (fields.maximumStock ?? undefined) : before.maximumStock;
  assertStockBounds(minimumStock, maximumStock);
  if (fields.minimumStock !== undefined) patch.minimumStock = fields.minimumStock;
  if (fields.maximumStock !== undefined) patch.maximumStock = fields.maximumStock ?? null;
  if (fields.trackInventory !== undefined) patch.trackInventory = fields.trackInventory;
  if (fields.status !== undefined) patch.status = fields.status;
  if (fields.sku !== undefined) {
    const sku = fields.sku.trim().toUpperCase();
    if (sku !== before.sku) {
      const clash = await deps.products.findBySku(ctx.tenantId, sku);
      if (clash) throw duplicate('sku');
    }
    patch.sku = sku;
  }
  if (patch.barcode !== undefined && patch.barcode !== null) {    const clash = await deps.products.findByBarcode(ctx.tenantId, patch.barcode);
    if (clash && clash._id !== id) throw duplicate('barcode');
  }
  const updated = await deps.products.update(ctx.tenantId, id, patch, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Product');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: INVENTORY_ACTIONS.PRODUCT_UPDATED,
    entityType: 'product',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { name: before.name, status: before.status },
    after: { name: updated.name, status: updated.status },
  });
  return updated;
}

export async function deactivateProduct(ctx: InventoryActor, id: string, deps: InventoryDeps) {
  const product = await deps.products.findById(ctx.tenantId, id);
  if (!product) throw notFound('Product');
  const updated = await deps.products.update(ctx.tenantId, id, { status: 'INACTIVE' }, product.version, ctx.userId);
  if (!updated) throw notFound('Product');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: INVENTORY_ACTIONS.PRODUCT_DEACTIVATED,
    entityType: 'product',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: product.status },
    after: { status: updated.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------

export interface CreateWarehouseInput {
  code: string;
  name: string;
  description?: string;
  address?: string;
}

export async function createWarehouse(ctx: InventoryActor, input: CreateWarehouseInput, deps: InventoryDeps) {
  const code = input.code.trim().toUpperCase();
  const existing = await deps.warehouses.findByCode(ctx.tenantId, code);
  if (existing) throw duplicate('code');
  const created = await deps.warehouses.create({
    tenantId: ctx.tenantId,
    code,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    address: input.address?.trim() || undefined,
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: INVENTORY_ACTIONS.WAREHOUSE_CREATED,
    entityType: 'warehouse',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { code: created.code, name: created.name },
  });
  return created;
}

export async function getWarehouse(ctx: InventoryActor, id: string, deps: InventoryDeps) {
  const warehouse = await deps.warehouses.findById(ctx.tenantId, id);
  if (!warehouse) throw notFound('Warehouse');
  return warehouse;
}

export async function listWarehouses(ctx: InventoryActor, filters: WarehouseFilters, page: number, limit: number, sortBy: string, sortOrder: 'asc' | 'desc', deps: InventoryDeps) {
  return deps.warehouses.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
}

export interface UpdateWarehouseInput {
  code?: string;
  name?: string;
  description?: string;
  address?: string;
  status?: InventoryStatus;
  expectedVersion: number;
}

export async function updateWarehouse(ctx: InventoryActor, id: string, input: UpdateWarehouseInput, deps: InventoryDeps) {
  const before = await deps.warehouses.findById(ctx.tenantId, id);
  if (!before) throw notFound('Warehouse');
  const { expectedVersion, ...fields } = input;
  const patch: { code?: string; name?: string; description?: string; address?: string; status?: InventoryStatus } = {};
  if (fields.code !== undefined) {
    const code = fields.code.trim().toUpperCase();
    if (code !== before.code) {
      const clash = await deps.warehouses.findByCode(ctx.tenantId, code);
      if (clash) throw duplicate('code');
    }
    patch.code = code;
  }
  if (fields.name !== undefined) patch.name = fields.name.trim();
  if (fields.description !== undefined) patch.description = fields.description?.trim() || undefined;
  if (fields.address !== undefined) patch.address = fields.address.trim() || undefined;
  if (fields.status !== undefined) patch.status = fields.status;
  const updated = await deps.warehouses.update(ctx.tenantId, id, patch, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Warehouse');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: INVENTORY_ACTIONS.WAREHOUSE_UPDATED,
    entityType: 'warehouse',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { name: before.name, status: before.status },
    after: { name: updated.name, status: updated.status },
  });
  return updated;
}

export async function deactivateWarehouse(ctx: InventoryActor, id: string, deps: InventoryDeps) {
  const warehouse = await deps.warehouses.findById(ctx.tenantId, id);
  if (!warehouse) throw notFound('Warehouse');
  const updated = await deps.warehouses.update(ctx.tenantId, id, { status: 'INACTIVE' }, warehouse.version, ctx.userId);
  if (!updated) throw notFound('Warehouse');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: INVENTORY_ACTIONS.WAREHOUSE_DEACTIVATED,
    entityType: 'warehouse',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: warehouse.status },
    after: { status: updated.status },
  });
  return updated;
}

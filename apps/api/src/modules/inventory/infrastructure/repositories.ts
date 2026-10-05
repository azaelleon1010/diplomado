/**
 * Inventory stores — Infrastructure implementations of domain ports.
 *
 * Each store composes a BaseRepository (tenant isolation inherited,
 * never duplicated) and exposes the narrow port interface. Composition
 * (instead of inheritance) keeps port signatures independent from the
 * generic base signatures.
 */
import { BaseRepository, mapMongoError, type TenantContext } from '@erp/database';
import type { ClientSession } from 'mongoose';
import type { TxSession } from '../../tenant/domain/ports';
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
import type { InventoryCategory, InventoryStatus, Product, Warehouse } from '../domain/entities';
import {
  CategoryModel,
  ProductModel,
  WarehouseModel,
  type CategoryDoc,
  type ProductDoc,
  type WarehouseDoc,
} from './models';

const oid = (v: unknown): string => String(v);
const sysCtx = (tenantId: string): TenantContext => ({ tenantId, userId: 'system' });
const asSession = (session?: TxSession): ClientSession | undefined =>
  (session as ClientSession | undefined) ?? undefined;

/**
 * Strip undefined values before persistence. The MongoDB driver serializes
 * explicit `undefined` as `null`, which would poison sparse unique indexes
 * (e.g. barcode) and store nulls instead of absent fields.
 */
function clean<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

function toCategory(doc: CategoryDoc): InventoryCategory {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    name: doc.name,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toProduct(doc: ProductDoc): Product {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    sku: doc.sku,
    name: doc.name,
    description: doc.description,
    categoryId: doc.categoryId,
    unit: doc.unit,
    barcode: doc.barcode,
    cost: doc.cost,
    price: doc.price,
    minimumStock: doc.minimumStock,
    maximumStock: doc.maximumStock,
    trackInventory: doc.trackInventory,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

function toWarehouse(doc: WarehouseDoc): Warehouse {
  return {
    _id: oid(doc._id),
    tenantId: doc.tenantId,
    code: doc.code,
    name: doc.name,
    description: doc.description,
    address: doc.address,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

class CategoryBaseRepo extends BaseRepository<CategoryDoc> {}
class ProductBaseRepo extends BaseRepository<ProductDoc> {}
class WarehouseBaseRepo extends BaseRepository<WarehouseDoc> {}

const CATEGORY_SORT_FIELDS = ['createdAt', 'updatedAt', 'name'];
const PRODUCT_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'sku', 'price'];
const WAREHOUSE_SORT_FIELDS = ['createdAt', 'updatedAt', 'name', 'code'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MongoCategoryStore implements ICategoryStore {
  private readonly base = new CategoryBaseRepo(CategoryModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<InventoryCategory | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toCategory(doc) : null;
  }

  async findByName(tenantId: string, name: string, session?: TxSession): Promise<InventoryCategory | null> {
    try {
      const q = CategoryModel.findOne({ tenantId, name });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toCategory(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: CategoryFilters, page: number, limit: number) {
    const filter: Record<string, unknown> = {};
    if (filters.search) filter.name = { $regex: escapeRegExp(filters.search.trim()), $options: 'i' };
    if (filters.status) filter.status = filters.status;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy: 'name', sortOrder: 'asc' }, undefined, { allowedSortFields: CATEGORY_SORT_FIELDS });
    return {
      data: result.data.map(toCategory),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: { tenantId: string; name: string; description?: string; createdBy: string }, session?: TxSession): Promise<InventoryCategory> {
    const created = await this.base.create(
      clean({ name: data.name, description: data.description, status: 'ACTIVE' }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toCategory(created);
  }

  async update(tenantId: string, id: string, patch: { name?: string; description?: string; status?: InventoryStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<InventoryCategory | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const updated = await this.base.updateById(id, patch, { tenantId, userId: updatedBy }, expectedVersion, asSession(session));
    return toCategory(updated);
  }

  async countActiveProducts(tenantId: string, categoryId: string, session?: TxSession): Promise<number> {
    try {
      const q = ProductModel.countDocuments({ tenantId, categoryId, status: 'ACTIVE' });
      const s = asSession(session);
      if (s) q.session(s);
      return await q.exec();
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

export class MongoProductStore implements IProductStore {
  private readonly base = new ProductBaseRepo(ProductModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<Product | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toProduct(doc) : null;
  }

  async findBySku(tenantId: string, sku: string, session?: TxSession): Promise<Product | null> {
    try {
      const q = ProductModel.findOne({ tenantId, sku: sku.trim().toUpperCase() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toProduct(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findByBarcode(tenantId: string, barcode: string, session?: TxSession): Promise<Product | null> {
    try {
      const q = ProductModel.findOne({ tenantId, barcode: barcode.trim() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toProduct(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: ProductFilters, page: number, limit: number, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.search) {
      const rx = { $regex: escapeRegExp(filters.search.trim()), $options: 'i' };
      filter.$or = [{ name: rx }, { sku: rx }, { barcode: rx }];
    }
    if (filters.categoryId) filter.categoryId = filters.categoryId;
    if (filters.status) filter.status = filters.status;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy, sortOrder }, undefined, { allowedSortFields: PRODUCT_SORT_FIELDS });
    return {
      data: result.data.map(toProduct),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: CreateProductData, session?: TxSession): Promise<Product> {
    const created = await this.base.create(
      clean({
        sku: data.sku.trim().toUpperCase(),
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        unit: data.unit,
        barcode: data.barcode?.trim() ? data.barcode.trim() : undefined,
        cost: data.cost,
        price: data.price,
        minimumStock: data.minimumStock,
        maximumStock: data.maximumStock,
        trackInventory: data.trackInventory,
        status: 'ACTIVE',
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toProduct(created);
  }

  async update(tenantId: string, id: string, patch: UpdateProductData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Product | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    // Split $set / $unset so nullable fields can be cleared atomically.
    const set: Record<string, unknown> = { updatedBy, updatedAt: new Date() };
    const unset: Record<string, unknown> = {};
    const put = (key: string, value: unknown) => {
      if (value === undefined) return;
      if (value === null) unset[key] = 1;
      else set[key] = value;
    };
    put('sku', typeof patch.sku === 'string' ? patch.sku.trim().toUpperCase() : undefined);
    put('name', typeof patch.name === 'string' ? patch.name.trim() : undefined);
    put('description', patch.description === undefined ? undefined : (patch.description?.trim() || null));
    put('categoryId', patch.categoryId);
    put('unit', typeof patch.unit === 'string' ? patch.unit.trim() : undefined);
    put('barcode', patch.barcode === undefined ? undefined : (patch.barcode?.trim() || null));
    put('cost', patch.cost);
    put('price', patch.price);
    put('minimumStock', patch.minimumStock);
    put('maximumStock', patch.maximumStock);
    put('trackInventory', patch.trackInventory);
    put('status', patch.status);
    try {
      const q = ProductModel.findOneAndUpdate(
        { tenantId, _id: id, version: expectedVersion },
        { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}), $inc: { version: 1 } },
        { new: true, runValidators: true },
      );
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (!updated) {
        const existsQ = ProductModel.findOne({ tenantId, _id: id });
        if (s) existsQ.session(s);
        const exists = await existsQ.exec();
        if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
        return null;
      }
      return toProduct(updated);
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

export class MongoWarehouseStore implements IWarehouseStore {
  private readonly base = new WarehouseBaseRepo(WarehouseModel);

  async findById(tenantId: string, id: string, session?: TxSession): Promise<Warehouse | null> {
    const doc = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    return doc ? toWarehouse(doc) : null;
  }

  async findByCode(tenantId: string, code: string, session?: TxSession): Promise<Warehouse | null> {
    try {
      const q = WarehouseModel.findOne({ tenantId, code: code.trim().toUpperCase() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toWarehouse(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: WarehouseFilters, page: number, limit: number, sortBy = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    const filter: Record<string, unknown> = {};
    if (filters.search) {
      const rx = { $regex: escapeRegExp(filters.search.trim()), $options: 'i' };
      filter.$or = [{ name: rx }, { code: rx }];
    }
    if (filters.status) filter.status = filters.status;
    const result = await this.base.findMany(filter, sysCtx(tenantId), { page, limit, sortBy, sortOrder }, undefined, { allowedSortFields: WAREHOUSE_SORT_FIELDS });
    return {
      data: result.data.map(toWarehouse),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async create(data: { tenantId: string; code: string; name: string; description?: string; address?: string; createdBy: string }, session?: TxSession): Promise<Warehouse> {
    const created = await this.base.create(
      clean({
        code: data.code.trim().toUpperCase(),
        name: data.name,
        description: data.description,
        address: data.address,
        status: 'ACTIVE',
      }),
      { tenantId: data.tenantId, userId: data.createdBy },
      asSession(session),
    );
    return toWarehouse(created);
  }

  async update(tenantId: string, id: string, patch: { code?: string; name?: string; description?: string; address?: string; status?: InventoryStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Warehouse | null> {
    const current = await this.base.findById(id, sysCtx(tenantId), asSession(session));
    if (!current) return null;
    const normalized: Record<string, unknown> = { ...patch };
    if (typeof normalized.code === 'string') normalized.code = (normalized.code as string).trim().toUpperCase();
    const updated = await this.base.updateById(id, normalized, { tenantId, userId: updatedBy }, expectedVersion, asSession(session));
    return toWarehouse(updated);
  }
}

/**
 * Inventory MongoDB models — Infrastructure layer.
 * Shared collections (never one collection per tenant).
 */
import mongoose, { Schema, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions } from '@erp/database';

export interface CategoryDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'inventoryCategories' },
);
categorySchema.index({ tenantId: 1, name: 1 }, { unique: true, name: 'uniq_tenant_category_name' });
addTenantIndex(categorySchema);

export interface ProductDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
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
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    sku: { type: String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: 64 },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    categoryId: { type: String, trim: true },
    unit: { type: String, required: true, trim: true, minlength: 1, maxlength: 20 },
    barcode: { type: String, trim: true, maxlength: 64 },
    cost: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    minimumStock: { type: Number, required: true, default: 0, min: 0 },
    maximumStock: { type: Number, min: 0 },
    trackInventory: { type: Boolean, default: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'products' },
);
productSchema.index({ tenantId: 1, sku: 1 }, { unique: true, name: 'uniq_tenant_sku' });
// NOTE: partial (not sparse). For compound indexes, MongoDB includes a
// document when ANY indexed field is present (missing fields read as null),
// so sparse would wrongly allow only one barcode-less product per tenant.
// Partial indexes only entries matching the filter.
productSchema.index(
  { tenantId: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $exists: true } },
    name: 'uniq_tenant_barcode_present',
  },
);
productSchema.index({ tenantId: 1, name: 1 }, { name: 'idx_tenant_product_name' });
productSchema.index({ tenantId: 1, categoryId: 1 }, { name: 'idx_tenant_category' });
addTenantIndex(productSchema);

export interface WarehouseDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const warehouseSchema = new Schema<WarehouseDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    code: { type: String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: 32 },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    address: { type: String, trim: true, maxlength: 300 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'warehouses' },
);
warehouseSchema.index({ tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_warehouse_code' });
warehouseSchema.index({ tenantId: 1, name: 1 }, { name: 'idx_tenant_warehouse_name' });
addTenantIndex(warehouseSchema);

function getOrCreate<T extends mongoose.Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const CategoryModel = getOrCreate<CategoryDoc>('InventoryCategory', categorySchema);
export const ProductModel = getOrCreate<ProductDoc>('InventoryProduct', productSchema);
export const WarehouseModel = getOrCreate<WarehouseDoc>('InventoryWarehouse', warehouseSchema);

/** Models whose indexes must exist before the API serves traffic. */
export const inventoryModels = [CategoryModel, ProductModel, WarehouseModel] as unknown as Array<import('mongoose').Model<unknown>>;

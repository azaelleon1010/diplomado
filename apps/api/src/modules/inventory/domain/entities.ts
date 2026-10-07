/**
 * Inventory domain entities — pure TypeScript.
 * No Express, no Mongoose, no JWT, no bcrypt allowed in this layer.
 */

export type InventoryStatus = 'ACTIVE' | 'INACTIVE';

export interface InventoryCategory {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: InventoryStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface Product {
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
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface Warehouse {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  address?: string;
  status: InventoryStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export const INVENTORY_ACTIONS = {
  CATEGORY_CREATED: 'inventory.category.created',
  CATEGORY_UPDATED: 'inventory.category.updated',
  CATEGORY_DEACTIVATED: 'inventory.category.deactivated',
  PRODUCT_CREATED: 'inventory.product.created',
  PRODUCT_UPDATED: 'inventory.product.updated',
  PRODUCT_DEACTIVATED: 'inventory.product.deactivated',
  WAREHOUSE_CREATED: 'inventory.warehouse.created',
  WAREHOUSE_UPDATED: 'inventory.warehouse.updated',
  WAREHOUSE_DEACTIVATED: 'inventory.warehouse.deactivated',
  STOCK_POSTED: 'inventory.stock.posted',
} as const;

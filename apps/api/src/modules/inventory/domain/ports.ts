/**
 * Inventory ports — abstractions owned by the Domain.
 * Infrastructure provides the implementations.
 * TxSession is reused from tenant ports (opaque handle, no driver in Domain).
 */
import type { TxSession } from '../../tenant/domain/ports';
import type { InventoryCategory, InventoryStatus, Product, Warehouse } from './entities';

export interface CategoryFilters {
  search?: string;
  status?: InventoryStatus;
}

export interface ICategoryStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<InventoryCategory | null>;
  findByName(tenantId: string, name: string, session?: TxSession): Promise<InventoryCategory | null>;
  list(tenantId: string, filters: CategoryFilters, page: number, limit: number): Promise<{
    data: InventoryCategory[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: { tenantId: string; name: string; description?: string; createdBy: string }, session?: TxSession): Promise<InventoryCategory>;
  update(tenantId: string, id: string, patch: { name?: string; description?: string; status?: InventoryStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<InventoryCategory | null>;
  countActiveProducts(tenantId: string, categoryId: string, session?: TxSession): Promise<number>;
}

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  status?: InventoryStatus;
}

export interface CreateProductData {
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
  createdBy: string;
}

export interface UpdateProductData {
  sku?: string;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
  unit?: string;
  barcode?: string | null;
  cost?: number;
  price?: number;
  minimumStock?: number;
  maximumStock?: number | null;
  trackInventory?: boolean;
  status?: InventoryStatus;
}

export interface IProductStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<Product | null>;
  findBySku(tenantId: string, sku: string, session?: TxSession): Promise<Product | null>;
  findByBarcode(tenantId: string, barcode: string, session?: TxSession): Promise<Product | null>;
  list(tenantId: string, filters: ProductFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: CreateProductData, session?: TxSession): Promise<Product>;
  update(tenantId: string, id: string, patch: UpdateProductData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Product | null>;
}

export interface WarehouseFilters {
  search?: string;
  status?: InventoryStatus;
}

export interface IWarehouseStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<Warehouse | null>;
  findByCode(tenantId: string, code: string, session?: TxSession): Promise<Warehouse | null>;
  list(tenantId: string, filters: WarehouseFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: Warehouse[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: { tenantId: string; code: string; name: string; description?: string; address?: string; createdBy: string }, session?: TxSession): Promise<Warehouse>;
  update(tenantId: string, id: string, patch: { code?: string; name?: string; description?: string; address?: string; status?: InventoryStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Warehouse | null>;
}

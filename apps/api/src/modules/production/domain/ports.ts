/**
 * Production ports — abstractions owned by the Domain.
 * Infrastructure provides the implementations.
 * TxSession is reused from tenant ports (opaque handle, no driver in Domain).
 */
import type { TxSession } from '../../tenant/domain/ports';
import type { ProductionOrder, ProductionOrderStatus } from './entities';

export interface ProductionOrderFilters {
  productId?: string;
  status?: ProductionOrderStatus;
}

export interface ProductionMaterialInput {
  productId: string;
  quantityRequired: number;
  quantityConsumed?: number;
}

export interface CreateProductionOrderData {
  tenantId: string;
  code: string;
  productId: string;
  quantity: number;
  machine?: string;
  responsible?: string;
  dueDate?: string;
  notes?: string;
  materials: ProductionMaterialInput[];
  createdBy: string;
}

export interface UpdateProductionOrderData {
  quantity?: number;
  machine?: string | null;
  responsible?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  materials?: ProductionMaterialInput[];
}

export interface IProductionOrderStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<ProductionOrder | null>;
  findByCode(tenantId: string, code: string, session?: TxSession): Promise<ProductionOrder | null>;
  list(tenantId: string, filters: ProductionOrderFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: ProductionOrder[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: CreateProductionOrderData, session?: TxSession): Promise<ProductionOrder>;
  update(tenantId: string, id: string, patch: UpdateProductionOrderData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<ProductionOrder | null>;
  transition(tenantId: string, id: string, to: ProductionOrderStatus, expectedVersion: number, updatedBy: string, extra?: { producedQuantity?: number; materials?: ProductionMaterialInput[] }, session?: TxSession): Promise<ProductionOrder | null>;
}

/**
 * Purchasing ports — abstractions owned by the Domain.
 * Infrastructure provides the implementations.
 * TxSession is reused from tenant ports (opaque handle, no driver in Domain).
 */
import type { TxSession } from '../../tenant/domain/ports';
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderStatus,
  Supplier,
  SupplierStatus,
} from './entities';

export interface SupplierFilters {
  search?: string;
  status?: SupplierStatus;
}

export interface ISupplierStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<Supplier | null>;
  findByCode(tenantId: string, code: string, session?: TxSession): Promise<Supplier | null>;
  list(tenantId: string, filters: SupplierFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: Supplier[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: { tenantId: string; code: string; name: string; contactName?: string; email?: string; phone?: string; address?: string; taxId?: string; createdBy: string }, session?: TxSession): Promise<Supplier>;
  update(tenantId: string, id: string, patch: { name?: string; contactName?: string | null; email?: string | null; phone?: string | null; address?: string | null; taxId?: string | null; status?: SupplierStatus }, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Supplier | null>;
}

export interface OrderFilters {
  supplierId?: string;
  status?: PurchaseOrderStatus;
}

export interface CreatePurchaseOrderData {
  tenantId: string;
  folio: string;
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number }>;
  createdBy: string;
}

export interface UpdatePurchaseOrderData {
  expectedDate?: string | null;
  notes?: string | null;
  lines?: Array<{ productId: string; quantity: number; unitCost: number }>;
}

export interface IPurchaseOrderStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<PurchaseOrder | null>;
  findByFolio(tenantId: string, folio: string, session?: TxSession): Promise<PurchaseOrder | null>;
  list(tenantId: string, filters: OrderFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: PurchaseOrder[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  countBySupplier(tenantId: string, supplierId: string, session?: TxSession): Promise<number>;
  create(data: CreatePurchaseOrderData, session?: TxSession): Promise<PurchaseOrder>;
  update(tenantId: string, id: string, patch: UpdatePurchaseOrderData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<PurchaseOrder | null>;
  transition(tenantId: string, id: string, to: PurchaseOrderStatus, expectedVersion: number, updatedBy: string, extra?: { lines?: PurchaseOrderLine[] }, session?: TxSession): Promise<PurchaseOrder | null>;
}

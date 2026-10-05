/**
 * Maintenance ports — abstractions owned by the Domain.
 * Infrastructure provides the implementations.
 * TxSession is reused from tenant ports (opaque handle, no driver in Domain).
 */
import type { TxSession } from '../../tenant/domain/ports';
import type {
  Asset,
  AssetStatus,
  MaintenanceOrder,
  MaintenanceOrderStatus,
  MaintenancePriority,
  MaintenanceType,
} from './entities';

export interface AssetFilters {
  search?: string;
  status?: AssetStatus;
  type?: string;
}

export interface CreateAssetData {
  tenantId: string;
  code: string;
  name: string;
  type: string;
  location?: string;
  responsible?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
  createdBy: string;
}

export interface UpdateAssetData {
  name?: string;
  type?: string;
  location?: string | null;
  responsible?: string | null;
  purchaseDate?: string | null;
  warrantyUntil?: string | null;
  notes?: string | null;
  status?: AssetStatus;
}

export interface IAssetStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<Asset | null>;
  findByCode(tenantId: string, code: string, session?: TxSession): Promise<Asset | null>;
  list(tenantId: string, filters: AssetFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: Asset[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  create(data: CreateAssetData, session?: TxSession): Promise<Asset>;
  update(tenantId: string, id: string, patch: UpdateAssetData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Asset | null>;
  setStatus(tenantId: string, id: string, status: AssetStatus, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<Asset | null>;
}

export interface OrderFilters {
  assetId?: string;
  status?: MaintenanceOrderStatus;
  priority?: MaintenancePriority;
  type?: MaintenanceType;
}

export interface CreateOrderData {
  tenantId: string;
  assetId: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  title: string;
  description?: string;
  scheduledFor?: string;
  cost: number;
  assignedTo?: string;
  notes?: string;
  createdBy: string;
}

export interface UpdateOrderData {
  title?: string;
  description?: string | null;
  priority?: MaintenancePriority;
  scheduledFor?: string | null;
  cost?: number;
  assignedTo?: string | null;
  notes?: string | null;
}

export interface IMaintenanceOrderStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<MaintenanceOrder | null>;
  list(tenantId: string, filters: OrderFilters, page: number, limit: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<{
    data: MaintenanceOrder[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  countOpenByAsset(tenantId: string, assetId: string, session?: TxSession): Promise<number>;
  create(data: CreateOrderData, session?: TxSession): Promise<MaintenanceOrder>;
  update(tenantId: string, id: string, patch: UpdateOrderData, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<MaintenanceOrder | null>;
  transition(tenantId: string, id: string, to: MaintenanceOrderStatus, expectedVersion: number, updatedBy: string, extra?: { completedCost?: number }, session?: TxSession): Promise<MaintenanceOrder | null>;
}

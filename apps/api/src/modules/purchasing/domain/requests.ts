/**
 * Purchase request (solicitud de compra): an internal need that must be
 * approved before anyone commits money with a supplier.
 */
import type { TxSession } from '../../tenant/domain/ports';

export type PurchaseRequestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ORDERED' | 'CANCELLED';

export const REQUEST_TRANSITIONS: Readonly<Record<PurchaseRequestStatus, readonly PurchaseRequestStatus[]>> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ORDERED', 'CANCELLED'],
  REJECTED: [],
  ORDERED: [],
  CANCELLED: [],
};

export interface PurchaseRequestLine {
  productId: string;
  quantity: number;
  notes?: string;
}

export interface PurchaseRequest {
  _id: string;
  tenantId: string;
  folio: string;
  requestedBy: string;
  department?: string;
  neededBy?: string;
  justification?: string;
  lines: PurchaseRequestLine[];
  status: PurchaseRequestStatus;
  submittedAt?: Date;
  decidedBy?: string;
  decidedAt?: Date;
  decisionReason?: string;
  purchaseOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface PurchaseRequestFilters {
  status?: PurchaseRequestStatus;
  requestedBy?: string;
}

export interface RequestStatusPatch {
  status: PurchaseRequestStatus;
  submittedAt?: Date;
  decidedBy?: string;
  decidedAt?: Date;
  decisionReason?: string;
  purchaseOrderId?: string;
}

export interface IPurchaseRequestStore {
  create(data: Omit<PurchaseRequest, '_id' | 'createdAt' | 'updatedAt' | 'version' | 'status'>, session?: TxSession): Promise<PurchaseRequest>;
  findById(tenantId: string, id: string, session?: TxSession): Promise<PurchaseRequest | null>;
  list(tenantId: string, filters: PurchaseRequestFilters, page: number, limit: number): Promise<{
    data: PurchaseRequest[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  updateDraft(tenantId: string, id: string, patch: { department?: string | null; neededBy?: string | null; justification?: string | null; lines?: PurchaseRequestLine[] }, expectedVersion: number, updatedBy: string): Promise<PurchaseRequest | null>;
  setStatus(tenantId: string, id: string, patch: RequestStatusPatch, expectedVersion: number, updatedBy: string, session?: TxSession): Promise<PurchaseRequest | null>;
}

export const REQUEST_FOLIO_PREFIX = 'SOL';
export const ORDER_FOLIO_PREFIX = 'OC';

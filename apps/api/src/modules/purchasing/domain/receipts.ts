/**
 * Goods receipt — the document that brings purchased goods into stock.
 *
 * A receipt is immutable once posted: it records what arrived, where and at
 * which cost, and links to the inventory posting it generated. Corrections
 * will be explicit returns/reversals, never edits.
 */
import type { TxSession } from '../../tenant/domain/ports';

export type GoodsReceiptStatus = 'POSTED';

export interface GoodsReceiptLine {
  productId: string;
  quantity: number;
  unitCost: number;
  /** False when the product does not track inventory (services). */
  stocked: boolean;
}

export interface GoodsReceipt {
  _id: string;
  tenantId: string;
  folio: string;
  purchaseOrderId: string;
  purchaseOrderFolio: string;
  supplierId: string;
  warehouseId: string;
  status: GoodsReceiptStatus;
  lines: GoodsReceiptLine[];
  total: number;
  /** Inventory posting id (absent if no line tracks stock). */
  postingId?: string;
  notes?: string;
  receivedAt: Date;
  createdBy: string;
  createdAt: Date;
}

export interface GoodsReceiptFilters {
  purchaseOrderId?: string;
  supplierId?: string;
  warehouseId?: string;
}

export interface IGoodsReceiptStore {
  newId(): string;
  create(data: Omit<GoodsReceipt, 'createdAt'>, session: TxSession): Promise<GoodsReceipt>;
  findById(tenantId: string, id: string, session?: TxSession): Promise<GoodsReceipt | null>;
  list(tenantId: string, filters: GoodsReceiptFilters, page: number, limit: number): Promise<{
    data: GoodsReceipt[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
}

export const RECEIPT_FOLIO_PREFIX = 'REC';

/**
 * Supplier quote (cotización) for a purchase request.
 * Quotes are compared per line; awarding one turns the request into a
 * purchase order with the quoted prices and discards the others.
 */
import type { TxSession } from '../../tenant/domain/ports';

export type SupplierQuoteStatus = 'RECEIVED' | 'AWARDED' | 'DISCARDED';

export interface SupplierQuoteLine {
  productId: string;
  unitCost: number;
  /** Quoted quantity when the supplier cannot cover the requested one. */
  quantity?: number;
  leadTimeDays?: number;
}

export interface SupplierQuote {
  _id: string;
  tenantId: string;
  folio: string;
  requestId: string;
  supplierId: string;
  currency: string;
  validUntil?: string;
  notes?: string;
  lines: SupplierQuoteLine[];
  /** Total over the requested quantities (or the quoted ones if given). */
  total: number;
  status: SupplierQuoteStatus;
  purchaseOrderId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface ISupplierQuoteStore {
  create(data: Omit<SupplierQuote, '_id' | 'createdAt' | 'updatedAt' | 'version' | 'status'>, session?: TxSession): Promise<SupplierQuote>;
  findById(tenantId: string, id: string, session?: TxSession): Promise<SupplierQuote | null>;
  findByRequestAndSupplier(tenantId: string, requestId: string, supplierId: string): Promise<SupplierQuote | null>;
  listByRequest(tenantId: string, requestId: string, session?: TxSession): Promise<SupplierQuote[]>;
  /** Awards one quote and discards the other RECEIVED quotes of the request. */
  award(tenantId: string, quoteId: string, requestId: string, purchaseOrderId: string, expectedVersion: number, updatedBy: string, session: TxSession): Promise<SupplierQuote | null>;
}

export const QUOTE_FOLIO_PREFIX = 'COT';

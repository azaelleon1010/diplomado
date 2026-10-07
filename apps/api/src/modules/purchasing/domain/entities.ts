/**
 * Purchasing domain entities — pure TypeScript.
 * No Express, no Mongoose, no JWT, no bcrypt allowed in this layer.
 *
 * Products always come from the inventory catalog (never duplicated).
 */

export type SupplierStatus = 'ACTIVE' | 'INACTIVE';

export interface SupplierContact {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  isPrimary?: boolean;
}

export interface Supplier {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  /** Commercial terms used as defaults by purchase orders and payables. */
  paymentTermsDays: number;
  currency: string;
  leadTimeDays?: number;
  contacts: SupplierContact[];
  status: SupplierStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SENT'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface PurchaseOrderLine {
  productId: string;
  quantity: number;
  unitCost: number;
  quantityReceived: number;
  /** Quantity already billed by supplier invoices (three-way match). */
  quantityInvoiced: number;
}

export interface PurchaseOrder {
  _id: string;
  tenantId: string;
  folio: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  expectedDate?: string;
  notes?: string;
  receivedAt?: string;
  approvedBy?: string;
  approvedAt?: Date;
  /** Purchase request this order was created from, if any. */
  requestId?: string;
  lines: PurchaseOrderLine[];
  subtotal: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export const PURCHASING_ACTIONS = {
  SUPPLIER_CREATED: 'purchasing.supplier.created',
  SUPPLIER_UPDATED: 'purchasing.supplier.updated',
  SUPPLIER_DEACTIVATED: 'purchasing.supplier.deactivated',
  ORDER_CREATED: 'purchasing.order.created',
  ORDER_UPDATED: 'purchasing.order.updated',
  ORDER_SENT: 'purchasing.order.sent',
  ORDER_APPROVED: 'purchasing.order.approved',
  ORDER_RECEIVED: 'purchasing.order.received',
  ORDER_CANCELLED: 'purchasing.order.cancelled',
  REQUEST_CREATED: 'purchasing.request.created',
  REQUEST_UPDATED: 'purchasing.request.updated',
  REQUEST_SUBMITTED: 'purchasing.request.submitted',
  REQUEST_APPROVED: 'purchasing.request.approved',
  REQUEST_REJECTED: 'purchasing.request.rejected',
  REQUEST_CANCELLED: 'purchasing.request.cancelled',
  REQUEST_ORDERED: 'purchasing.request.ordered',
  QUOTE_RECEIVED: 'purchasing.quote.received',
  QUOTE_AWARDED: 'purchasing.quote.awarded',
  INVOICE_POSTED: 'purchasing.invoice.posted',
  INVOICE_HELD: 'purchasing.invoice.held',
  INVOICE_RELEASED: 'purchasing.invoice.released',
  INVOICE_CANCELLED: 'purchasing.invoice.cancelled',
  RECEIPT_POSTED: 'purchasing.receipt.posted',
} as const;

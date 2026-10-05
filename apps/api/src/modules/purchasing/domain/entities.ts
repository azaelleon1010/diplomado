/**
 * Purchasing domain entities — pure TypeScript.
 * No Express, no Mongoose, no JWT, no bcrypt allowed in this layer.
 *
 * Products always come from the inventory catalog (never duplicated).
 */

export type SupplierStatus = 'ACTIVE' | 'INACTIVE';

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
  lines: PurchaseOrderLine[];
  subtotal: number;
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
} as const;

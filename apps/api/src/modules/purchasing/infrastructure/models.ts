/**
 * Purchasing MongoDB models — Infrastructure layer.
 * Shared collections (never one collection per tenant).
 * Products always come from the inventory catalog (never duplicated).
 */
import mongoose, { Schema, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions } from '@erp/database';

export interface SupplierDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  currency?: string;
  leadTimeDays?: number;
  contacts?: Array<{ name: string; email?: string; phone?: string; role?: string; isPrimary?: boolean }>;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const supplierSchema = new Schema<SupplierDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    code: { type: String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: 32 },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    contactName: { type: String, trim: true, maxlength: 200 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    address: { type: String, trim: true, maxlength: 300 },
    taxId: { type: String, trim: true, maxlength: 40 },
    paymentTermsDays: { type: Number, min: 0, max: 365, default: 0 },
    currency: { type: String, trim: true, uppercase: true, minlength: 3, maxlength: 3, default: 'MXN' },
    leadTimeDays: { type: Number, min: 0, max: 365 },
    contacts: {
      type: [
        new Schema(
          {
            name: { type: String, required: true, trim: true, maxlength: 200 },
            email: { type: String, trim: true, lowercase: true, maxlength: 254 },
            phone: { type: String, trim: true, maxlength: 40 },
            role: { type: String, trim: true, maxlength: 100 },
            isPrimary: { type: Boolean },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'suppliers' },
);
supplierSchema.index({ tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_supplier_code' });
supplierSchema.index({ tenantId: 1, name: 1 }, { name: 'idx_tenant_supplier_name' });
addTenantIndex(supplierSchema);

export interface PurchaseOrderDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  folio: string;
  supplierId: string;
  status: 'DRAFT' | 'SENT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED';
  expectedDate?: string;
  notes?: string;
  receivedAt?: string;
  approvedBy?: string;
  approvedAt?: Date;
  requestId?: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number; quantityReceived: number }>;
  subtotal: number;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const purchaseLineSchema = new Schema(
  {
    productId: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    quantityReceived: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

const purchaseOrderSchema = new Schema<PurchaseOrderDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    folio: { type: String, required: true, trim: true, uppercase: true, minlength: 1, maxlength: 32 },
    supplierId: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['DRAFT', 'SENT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    expectedDate: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 2000 },
    receivedAt: { type: String, trim: true },
    approvedBy: { type: String, trim: true },
    approvedAt: { type: Date },
    requestId: { type: String },
    lines: { type: [purchaseLineSchema], default: [] },
    subtotal: { type: Number, required: true, default: 0, min: 0 },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'purchaseOrders' },
);
purchaseOrderSchema.index({ tenantId: 1, folio: 1 }, { unique: true, name: 'uniq_tenant_purchase_folio' });
purchaseOrderSchema.index({ tenantId: 1, supplierId: 1, status: 1 }, { name: 'idx_tenant_supplier_status' });
addTenantIndex(purchaseOrderSchema);

function getOrCreate<T extends mongoose.Document>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const SupplierModel = getOrCreate<SupplierDoc>('PurchasingSupplier', supplierSchema);
export const PurchaseOrderModel = getOrCreate<PurchaseOrderDoc>('PurchaseOrder', purchaseOrderSchema);

/** Models whose indexes must exist before the API serves traffic. */
export const purchasingModels = [SupplierModel, PurchaseOrderModel] as unknown as Array<import('mongoose').Model<unknown>>;

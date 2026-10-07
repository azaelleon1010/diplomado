/**
 * Supplier invoices (accounts payable) — MongoDB model + store.
 */
import mongoose, { Schema, type ClientSession, type FilterQuery, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions, mapMongoError } from '@erp/database';
import type { TxSession } from '../../tenant/domain/ports';
import type { ISupplierInvoiceStore, SupplierInvoice, SupplierInvoiceFilters, SupplierInvoiceStatus } from '../domain/invoices';

interface SupplierInvoiceDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  folio: string;
  supplierInvoiceNumber: string;
  supplierId: string;
  purchaseOrderId: string;
  purchaseOrderFolio: string;
  currency: string;
  invoiceDate: string;
  dueDate: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number; orderUnitCost: number }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: SupplierInvoiceStatus;
  matchIssues: Array<{ productId: string; type: 'PRICE_VARIANCE'; orderUnitCost: number; invoiceUnitCost: number; variancePct: number }>;
  releasedBy?: string;
  releasedAt?: Date;
  notes?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const invoiceSchema = new Schema<SupplierInvoiceDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    folio: { type: String, required: true },
    supplierInvoiceNumber: { type: String, required: true, trim: true, uppercase: true, maxlength: 60 },
    supplierId: { type: String, required: true },
    purchaseOrderId: { type: String, required: true },
    purchaseOrderFolio: { type: String, required: true },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    invoiceDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    lines: {
      type: [
        new Schema(
          {
            productId: { type: String, required: true },
            quantity: { type: Number, required: true, min: 0 },
            unitCost: { type: Number, required: true, min: 0 },
            orderUnitCost: { type: Number, required: true, min: 0 },
          },
          { _id: false },
        ),
      ],
      required: true,
    },
    subtotal: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, required: true, min: 0, max: 1 },
    taxAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    balance: { type: Number, required: true, min: 0 },
    status: { type: String, required: true, enum: ['ON_HOLD', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] },
    matchIssues: {
      type: [
        new Schema(
          {
            productId: { type: String, required: true },
            type: { type: String, required: true, enum: ['PRICE_VARIANCE'] },
            orderUnitCost: { type: Number, required: true },
            invoiceUnitCost: { type: Number, required: true },
            variancePct: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    releasedBy: { type: String },
    releasedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 1000 },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'supplierInvoices' },
);
invoiceSchema.index({ tenantId: 1, folio: 1 }, { unique: true, name: 'uniq_tenant_invoice_folio' });
invoiceSchema.index({ tenantId: 1, supplierId: 1, supplierInvoiceNumber: 1 }, { unique: true, name: 'uniq_tenant_supplier_invoice_number' });
invoiceSchema.index({ tenantId: 1, purchaseOrderId: 1 }, { name: 'idx_tenant_order' });
invoiceSchema.index({ tenantId: 1, status: 1, dueDate: 1 }, { name: 'idx_tenant_status_due' });
addTenantIndex(invoiceSchema);

export const SupplierInvoiceModel: Model<SupplierInvoiceDoc> =
  (mongoose.models.SupplierInvoice as Model<SupplierInvoiceDoc> | undefined) ??
  mongoose.model<SupplierInvoiceDoc>('SupplierInvoice', invoiceSchema);

export const invoiceModels = [SupplierInvoiceModel] as unknown as Array<Model<unknown>>;

const OPEN_STATUSES: SupplierInvoiceStatus[] = ['POSTED', 'PARTIALLY_PAID'];

function toInvoice(doc: SupplierInvoiceDoc): SupplierInvoice {
  return {
    _id: String(doc._id),
    tenantId: doc.tenantId,
    folio: doc.folio,
    supplierInvoiceNumber: doc.supplierInvoiceNumber,
    supplierId: doc.supplierId,
    purchaseOrderId: doc.purchaseOrderId,
    purchaseOrderFolio: doc.purchaseOrderFolio,
    currency: doc.currency,
    invoiceDate: doc.invoiceDate,
    dueDate: doc.dueDate,
    lines: doc.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, orderUnitCost: l.orderUnitCost })),
    subtotal: doc.subtotal,
    taxRate: doc.taxRate,
    taxAmount: doc.taxAmount,
    total: doc.total,
    amountPaid: doc.amountPaid,
    balance: doc.balance,
    status: doc.status,
    matchIssues: (doc.matchIssues ?? []).map((m) => ({ productId: m.productId, type: m.type, orderUnitCost: m.orderUnitCost, invoiceUnitCost: m.invoiceUnitCost, variancePct: m.variancePct })),
    releasedBy: doc.releasedBy,
    releasedAt: doc.releasedAt,
    notes: doc.notes,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

const asSession = (session?: TxSession) => session as ClientSession | undefined;

function buildFilter(tenantId: string, filters: SupplierInvoiceFilters): FilterQuery<SupplierInvoiceDoc> {
  const filter: FilterQuery<SupplierInvoiceDoc> = { tenantId };
  if (filters.supplierId) filter.supplierId = filters.supplierId;
  if (filters.purchaseOrderId) filter.purchaseOrderId = filters.purchaseOrderId;
  if (filters.status) filter.status = filters.status;
  if (filters.open) filter.status = { $in: OPEN_STATUSES };
  return filter;
}

export class MongoSupplierInvoiceStore implements ISupplierInvoiceStore {
  async create(data: Omit<SupplierInvoice, '_id' | 'createdAt' | 'updatedAt' | 'version'>, session: TxSession) {
    try {
      const [doc] = await SupplierInvoiceModel.create([{ ...data, updatedBy: data.createdBy }], { session: asSession(session) });
      return toInvoice(doc as SupplierInvoiceDoc);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findById(tenantId: string, id: string, session?: TxSession) {
    if (!mongoose.isValidObjectId(id)) return null;
    try {
      const q = SupplierInvoiceModel.findOne({ tenantId, _id: id });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toInvoice(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findBySupplierNumber(tenantId: string, supplierId: string, number: string, session?: TxSession) {
    try {
      const q = SupplierInvoiceModel.findOne({ tenantId, supplierId, supplierInvoiceNumber: number.trim().toUpperCase() });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toInvoice(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: SupplierInvoiceFilters, page: number, limit: number) {
    const filter = buildFilter(tenantId, filters);
    try {
      const [docs, total] = await Promise.all([
        SupplierInvoiceModel.find(filter).sort({ dueDate: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
        SupplierInvoiceModel.countDocuments(filter).exec(),
      ]);
      return { data: docs.map(toInvoice), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async listOpen(tenantId: string, supplierId?: string) {
    try {
      const docs = await SupplierInvoiceModel.find(buildFilter(tenantId, { supplierId, open: true })).sort({ dueDate: 1 }).limit(5000).exec();
      return docs.map(toInvoice);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async setStatus(tenantId: string, id: string, patch: { status: SupplierInvoiceStatus; releasedBy?: string; releasedAt?: Date }, expectedVersion: number, updatedBy: string, session?: TxSession) {
    if (!mongoose.isValidObjectId(id)) return null;
    const set: Record<string, unknown> = { updatedBy };
    for (const [key, value] of Object.entries(patch)) if (value !== undefined) set[key] = value;
    if (patch.status === 'CANCELLED') set.balance = 0;
    try {
      const q = SupplierInvoiceModel.findOneAndUpdate({ tenantId, _id: id, version: expectedVersion }, { $set: set, $inc: { version: 1 } }, { new: true });
      const s = asSession(session);
      if (s) q.session(s);
      const updated = await q.exec();
      if (updated) return toInvoice(updated);
      const exists = await SupplierInvoiceModel.exists({ tenantId, _id: id }).session(s ?? null).exec();
      if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
      return null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

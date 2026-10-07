/**
 * Supplier quotes — MongoDB model + store.
 */
import mongoose, { Schema, type ClientSession, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions, mapMongoError } from '@erp/database';
import type { TxSession } from '../../tenant/domain/ports';
import type { ISupplierQuoteStore, SupplierQuote, SupplierQuoteStatus } from '../domain/quotes';

interface SupplierQuoteDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  folio: string;
  requestId: string;
  supplierId: string;
  currency: string;
  validUntil?: string;
  notes?: string;
  lines: Array<{ productId: string; unitCost: number; quantity?: number; leadTimeDays?: number }>;
  total: number;
  status: SupplierQuoteStatus;
  purchaseOrderId?: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const lineSchema = new Schema(
  {
    productId: { type: String, required: true },
    unitCost: { type: Number, required: true, min: 0 },
    quantity: { type: Number, min: 0 },
    leadTimeDays: { type: Number, min: 0, max: 365 },
  },
  { _id: false },
);

const quoteSchema = new Schema<SupplierQuoteDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    folio: { type: String, required: true },
    requestId: { type: String, required: true },
    supplierId: { type: String, required: true },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    validUntil: { type: String, trim: true, maxlength: 30 },
    notes: { type: String, trim: true, maxlength: 1000 },
    lines: { type: [lineSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, required: true, enum: ['RECEIVED', 'AWARDED', 'DISCARDED'], default: 'RECEIVED' },
    purchaseOrderId: { type: String },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'supplierQuotes' },
);
quoteSchema.index({ tenantId: 1, folio: 1 }, { unique: true, name: 'uniq_tenant_quote_folio' });
quoteSchema.index({ tenantId: 1, requestId: 1, supplierId: 1 }, { unique: true, name: 'uniq_tenant_request_supplier' });
addTenantIndex(quoteSchema);

export const SupplierQuoteModel: Model<SupplierQuoteDoc> =
  (mongoose.models.SupplierQuote as Model<SupplierQuoteDoc> | undefined) ?? mongoose.model<SupplierQuoteDoc>('SupplierQuote', quoteSchema);

export const quoteModels = [SupplierQuoteModel] as unknown as Array<Model<unknown>>;

function toQuote(doc: SupplierQuoteDoc): SupplierQuote {
  return {
    _id: String(doc._id),
    tenantId: doc.tenantId,
    folio: doc.folio,
    requestId: doc.requestId,
    supplierId: doc.supplierId,
    currency: doc.currency,
    validUntil: doc.validUntil,
    notes: doc.notes,
    lines: doc.lines.map((l) => ({
      productId: l.productId,
      unitCost: l.unitCost,
      ...(l.quantity !== undefined && l.quantity !== null ? { quantity: l.quantity } : {}),
      ...(l.leadTimeDays !== undefined && l.leadTimeDays !== null ? { leadTimeDays: l.leadTimeDays } : {}),
    })),
    total: doc.total,
    status: doc.status,
    purchaseOrderId: doc.purchaseOrderId,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

const asSession = (session?: TxSession) => session as ClientSession | undefined;

export class MongoSupplierQuoteStore implements ISupplierQuoteStore {
  async create(data: Omit<SupplierQuote, '_id' | 'createdAt' | 'updatedAt' | 'version' | 'status'>, session?: TxSession) {
    try {
      const [doc] = await SupplierQuoteModel.create([{ ...data, status: 'RECEIVED', updatedBy: data.createdBy }], { session: asSession(session) });
      return toQuote(doc as SupplierQuoteDoc);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findById(tenantId: string, id: string, session?: TxSession) {
    if (!mongoose.isValidObjectId(id)) return null;
    try {
      const q = SupplierQuoteModel.findOne({ tenantId, _id: id });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toQuote(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findByRequestAndSupplier(tenantId: string, requestId: string, supplierId: string) {
    try {
      const doc = await SupplierQuoteModel.findOne({ tenantId, requestId, supplierId }).exec();
      return doc ? toQuote(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async listByRequest(tenantId: string, requestId: string, session?: TxSession) {
    try {
      const q = SupplierQuoteModel.find({ tenantId, requestId }).sort({ total: 1, createdAt: 1 });
      const s = asSession(session);
      if (s) q.session(s);
      return (await q.exec()).map(toQuote);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async award(tenantId: string, quoteId: string, requestId: string, purchaseOrderId: string, expectedVersion: number, updatedBy: string, session: TxSession) {
    const s = asSession(session);
    try {
      const awarded = await SupplierQuoteModel.findOneAndUpdate(
        { tenantId, _id: quoteId, requestId, status: 'RECEIVED', version: expectedVersion },
        { $set: { status: 'AWARDED', purchaseOrderId, updatedBy }, $inc: { version: 1 } },
        { new: true, session: s },
      ).exec();
      if (!awarded) {
        const exists = await SupplierQuoteModel.exists({ tenantId, _id: quoteId }).session(s ?? null).exec();
        if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
        return null;
      }
      await SupplierQuoteModel.updateMany(
        { tenantId, requestId, status: 'RECEIVED', _id: { $ne: awarded._id } },
        { $set: { status: 'DISCARDED', updatedBy }, $inc: { version: 1 } },
        { session: s },
      ).exec();
      return toQuote(awarded);
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

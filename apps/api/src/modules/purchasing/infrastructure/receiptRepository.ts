/**
 * Goods receipts — MongoDB model + store (append-only documents).
 */
import mongoose, { Schema, type ClientSession, type FilterQuery, type Model } from 'mongoose';
import { mapMongoError } from '@erp/database';
import type { TxSession } from '../../tenant/domain/ports';
import type { GoodsReceipt, GoodsReceiptFilters, IGoodsReceiptStore } from '../domain/receipts';

interface GoodsReceiptDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  folio: string;
  purchaseOrderId: string;
  purchaseOrderFolio: string;
  supplierId: string;
  warehouseId: string;
  status: 'POSTED';
  lines: Array<{ productId: string; quantity: number; unitCost: number; stocked: boolean }>;
  total: number;
  postingId?: string;
  notes?: string;
  receivedAt: Date;
  createdBy: string;
  createdAt: Date;
}

const lineSchema = new Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    stocked: { type: Boolean, required: true },
  },
  { _id: false },
);

const receiptSchema = new Schema<GoodsReceiptDoc>(
  {
    tenantId: { type: String, required: true, trim: true },
    folio: { type: String, required: true },
    purchaseOrderId: { type: String, required: true },
    purchaseOrderFolio: { type: String, required: true },
    supplierId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    status: { type: String, required: true, enum: ['POSTED'], default: 'POSTED' },
    lines: { type: [lineSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    postingId: { type: String },
    notes: { type: String, trim: true, maxlength: 1000 },
    receivedAt: { type: Date, required: true },
    createdBy: { type: String, required: true },
  },
  { collection: 'goodsReceipts', timestamps: { createdAt: 'createdAt', updatedAt: false }, versionKey: false },
);
receiptSchema.index({ tenantId: 1, folio: 1 }, { unique: true, name: 'uniq_tenant_receipt_folio' });
receiptSchema.index({ tenantId: 1, purchaseOrderId: 1, createdAt: -1 }, { name: 'idx_tenant_order_created' });
receiptSchema.index({ tenantId: 1, supplierId: 1, createdAt: -1 }, { name: 'idx_tenant_supplier_created' });
receiptSchema.index({ tenantId: 1, createdAt: -1 }, { name: 'idx_tenant_created' });

export const GoodsReceiptModel: Model<GoodsReceiptDoc> =
  (mongoose.models.GoodsReceipt as Model<GoodsReceiptDoc> | undefined) ??
  mongoose.model<GoodsReceiptDoc>('GoodsReceipt', receiptSchema);

export const receiptModels = [GoodsReceiptModel] as unknown as Array<Model<unknown>>;

function toReceipt(doc: GoodsReceiptDoc): GoodsReceipt {
  return {
    _id: String(doc._id),
    tenantId: doc.tenantId,
    folio: doc.folio,
    purchaseOrderId: doc.purchaseOrderId,
    purchaseOrderFolio: doc.purchaseOrderFolio,
    supplierId: doc.supplierId,
    warehouseId: doc.warehouseId,
    status: doc.status,
    lines: doc.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, stocked: l.stocked })),
    total: doc.total,
    postingId: doc.postingId,
    notes: doc.notes,
    receivedAt: doc.receivedAt,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt,
  };
}

export class MongoGoodsReceiptStore implements IGoodsReceiptStore {
  newId(): string {
    return new mongoose.Types.ObjectId().toHexString();
  }

  async create(data: Omit<GoodsReceipt, 'createdAt'>, session: TxSession): Promise<GoodsReceipt> {
    try {
      const { _id, ...rest } = data;
      const [doc] = await GoodsReceiptModel.create([{ ...rest, _id: new mongoose.Types.ObjectId(_id) }], { session: session as ClientSession });
      return toReceipt(doc as GoodsReceiptDoc);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findById(tenantId: string, id: string, session?: TxSession): Promise<GoodsReceipt | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    try {
      const q = GoodsReceiptModel.findOne({ tenantId, _id: id });
      if (session) q.session(session as ClientSession);
      const doc = await q.exec();
      return doc ? toReceipt(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: GoodsReceiptFilters, page: number, limit: number) {
    const filter: FilterQuery<GoodsReceiptDoc> = { tenantId };
    if (filters.purchaseOrderId) filter.purchaseOrderId = filters.purchaseOrderId;
    if (filters.supplierId) filter.supplierId = filters.supplierId;
    if (filters.warehouseId) filter.warehouseId = filters.warehouseId;
    try {
      const [docs, total] = await Promise.all([
        GoodsReceiptModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).exec(),
        GoodsReceiptModel.countDocuments(filter).exec(),
      ]);
      return { data: docs.map(toReceipt), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

/**
 * Purchase requests — MongoDB model + store (tenant-scoped, versioned).
 */
import mongoose, { Schema, type ClientSession, type FilterQuery, type Model } from 'mongoose';
import { addTenantIndex, baseFields, baseOptions, mapMongoError } from '@erp/database';
import type { TxSession } from '../../tenant/domain/ports';
import type {
  IPurchaseRequestStore,
  PurchaseRequest,
  PurchaseRequestFilters,
  PurchaseRequestLine,
  PurchaseRequestStatus,
  RequestStatusPatch,
} from '../domain/requests';

interface PurchaseRequestDoc extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  tenantId: string;
  folio: string;
  requestedBy: string;
  department?: string;
  neededBy?: string;
  justification?: string;
  lines: Array<{ productId: string; quantity: number; notes?: string }>;
  status: PurchaseRequestStatus;
  submittedAt?: Date;
  decidedBy?: string;
  decidedAt?: Date;
  decisionReason?: string;
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
    quantity: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const requestSchema = new Schema<PurchaseRequestDoc>(
  {
    ...(baseFields as Record<string, unknown>),
    folio: { type: String, required: true },
    requestedBy: { type: String, required: true },
    department: { type: String, trim: true, maxlength: 120 },
    neededBy: { type: String, trim: true, maxlength: 30 },
    justification: { type: String, trim: true, maxlength: 1000 },
    lines: { type: [lineSchema], required: true },
    status: { type: String, required: true, enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ORDERED', 'CANCELLED'], default: 'DRAFT' },
    submittedAt: { type: Date },
    decidedBy: { type: String },
    decidedAt: { type: Date },
    decisionReason: { type: String, trim: true, maxlength: 500 },
    purchaseOrderId: { type: String },
  } as Record<string, unknown>,
  { ...baseOptions, collection: 'purchaseRequests' },
);
requestSchema.index({ tenantId: 1, folio: 1 }, { unique: true, name: 'uniq_tenant_request_folio' });
requestSchema.index({ tenantId: 1, status: 1, createdAt: -1 }, { name: 'idx_tenant_status_created' });
requestSchema.index({ tenantId: 1, requestedBy: 1, createdAt: -1 }, { name: 'idx_tenant_requester_created' });
addTenantIndex(requestSchema);

export const PurchaseRequestModel: Model<PurchaseRequestDoc> =
  (mongoose.models.PurchaseRequest as Model<PurchaseRequestDoc> | undefined) ??
  mongoose.model<PurchaseRequestDoc>('PurchaseRequest', requestSchema);

export const requestModels = [PurchaseRequestModel] as unknown as Array<Model<unknown>>;

function toRequest(doc: PurchaseRequestDoc): PurchaseRequest {
  return {
    _id: String(doc._id),
    tenantId: doc.tenantId,
    folio: doc.folio,
    requestedBy: doc.requestedBy,
    department: doc.department,
    neededBy: doc.neededBy,
    justification: doc.justification,
    lines: doc.lines.map((l) => ({ productId: l.productId, quantity: l.quantity, ...(l.notes ? { notes: l.notes } : {}) })),
    status: doc.status,
    submittedAt: doc.submittedAt,
    decidedBy: doc.decidedBy,
    decidedAt: doc.decidedAt,
    decisionReason: doc.decisionReason,
    purchaseOrderId: doc.purchaseOrderId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    version: doc.version,
  };
}

const asSession = (session?: TxSession) => session as ClientSession | undefined;

async function versionedUpdate(tenantId: string, id: string, expectedVersion: number, update: Record<string, unknown>, session?: TxSession): Promise<PurchaseRequest | null> {
  if (!mongoose.isValidObjectId(id)) return null;
  try {
    const q = PurchaseRequestModel.findOneAndUpdate({ tenantId, _id: id, version: expectedVersion }, { ...update, $inc: { version: 1 } }, { new: true, runValidators: true });
    const s = asSession(session);
    if (s) q.session(s);
    const updated = await q.exec();
    if (updated) return toRequest(updated);
    const existsQ = PurchaseRequestModel.exists({ tenantId, _id: id });
    if (s) existsQ.session(s);
    if (await existsQ.exec()) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
    return null;
  } catch (err) {
    throw mapMongoError(err);
  }
}

export class MongoPurchaseRequestStore implements IPurchaseRequestStore {
  async create(data: Omit<PurchaseRequest, '_id' | 'createdAt' | 'updatedAt' | 'version' | 'status'>, session?: TxSession): Promise<PurchaseRequest> {
    try {
      const [doc] = await PurchaseRequestModel.create(
        [{ ...data, status: 'DRAFT', createdBy: data.requestedBy, updatedBy: data.requestedBy }],
        { session: asSession(session) },
      );
      return toRequest(doc as PurchaseRequestDoc);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findById(tenantId: string, id: string, session?: TxSession): Promise<PurchaseRequest | null> {
    if (!mongoose.isValidObjectId(id)) return null;
    try {
      const q = PurchaseRequestModel.findOne({ tenantId, _id: id });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? toRequest(doc) : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async list(tenantId: string, filters: PurchaseRequestFilters, page: number, limit: number) {
    const filter: FilterQuery<PurchaseRequestDoc> = { tenantId };
    if (filters.status) filter.status = filters.status;
    if (filters.requestedBy) filter.requestedBy = filters.requestedBy;
    try {
      const [docs, total] = await Promise.all([
        PurchaseRequestModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).exec(),
        PurchaseRequestModel.countDocuments(filter).exec(),
      ]);
      return { data: docs.map(toRequest), total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async updateDraft(tenantId: string, id: string, patch: { department?: string | null; neededBy?: string | null; justification?: string | null; lines?: PurchaseRequestLine[] }, expectedVersion: number, updatedBy: string) {
    const set: Record<string, unknown> = { updatedBy };
    const unset: Record<string, 1> = {};
    for (const key of ['department', 'neededBy', 'justification'] as const) {
      const value = patch[key];
      if (value === undefined) continue;
      if (value === null || value.trim() === '') unset[key] = 1;
      else set[key] = value.trim();
    }
    if (patch.lines !== undefined) set.lines = patch.lines;
    return versionedUpdate(tenantId, id, expectedVersion, { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) });
  }

  async setStatus(tenantId: string, id: string, patch: RequestStatusPatch, expectedVersion: number, updatedBy: string, session?: TxSession) {
    const set: Record<string, unknown> = { updatedBy };
    for (const [key, value] of Object.entries(patch)) if (value !== undefined) set[key] = value;
    return versionedUpdate(tenantId, id, expectedVersion, { $set: set }, session);
  }
}

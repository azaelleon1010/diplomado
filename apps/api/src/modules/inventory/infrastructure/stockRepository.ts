/**
 * MongoDB implementation of the inventory ledger port.
 * Every query is tenant-scoped; balance updates are single atomic
 * findOneAndUpdate operations so concurrent issues cannot go negative.
 */
import { mapMongoError } from '@erp/database';
import type { ClientSession, FilterQuery } from 'mongoose';
import type { TxSession } from '../../tenant/domain/ports';
import {
  roundQuantity,
  type IStockLedger,
  type Paged,
  type StockBalance,
  type StockBalanceFilters,
  type StockMovement,
  type StockMovementFilters,
  type StockMovementType,
  type StockSourceType,
} from '../domain/stock';
import { StockBalanceModel, StockMovementModel, type StockBalanceDoc, type StockMovementDoc } from './stockModels';

const asSession = (session?: TxSession) => session as ClientSession | undefined;

function toMovement(doc: StockMovementDoc): StockMovement {
  return {
    _id: String(doc._id),
    tenantId: doc.tenantId,
    postingId: doc.postingId,
    productId: doc.productId,
    warehouseId: doc.warehouseId,
    type: doc.type as StockMovementType,
    direction: doc.direction,
    quantity: doc.quantity,
    unitCost: doc.unitCost,
    balanceAfter: doc.balanceAfter,
    source: {
      type: doc.source.type as StockSourceType,
      ...(doc.source.id ? { id: doc.source.id } : {}),
      ...(doc.source.reference ? { reference: doc.source.reference } : {}),
    },
    notes: doc.notes,
    createdAt: doc.createdAt,
    createdBy: doc.createdBy,
  };
}

function toBalance(doc: StockBalanceDoc): StockBalance {
  return {
    _id: String(doc._id),
    tenantId: doc.tenantId,
    productId: doc.productId,
    warehouseId: doc.warehouseId,
    quantity: doc.quantity,
    updatedAt: doc.updatedAt,
  };
}

function paged<T>(data: T[], total: number, page: number, limit: number): Paged<T> {
  return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Persists the 3-decimal value when float residue appears after $inc. */
async function normalize(doc: StockBalanceDoc, session: TxSession): Promise<number> {
  const rounded = Math.max(0, roundQuantity(doc.quantity));
  if (rounded !== doc.quantity) {
    await StockBalanceModel.updateOne({ _id: doc._id }, { $set: { quantity: rounded } }, { session: asSession(session) }).exec();
  }
  return rounded;
}

export class MongoStockLedger implements IStockLedger {
  async increase(tenantId: string, productId: string, warehouseId: string, quantity: number, userId: string, session: TxSession): Promise<number> {
    try {
      const doc = await StockBalanceModel.findOneAndUpdate(
        { tenantId, productId, warehouseId },
        {
          $inc: { quantity, version: 1 },
          $set: { updatedBy: userId },
          $setOnInsert: { createdBy: userId },
        },
        { upsert: true, new: true, session: asSession(session) },
      ).exec();
      return await normalize(doc, session);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async decrease(tenantId: string, productId: string, warehouseId: string, quantity: number, userId: string, session: TxSession): Promise<number | null> {
    try {
      const doc = await StockBalanceModel.findOneAndUpdate(
        // Small epsilon tolerates float residue from decimal quantities.
        { tenantId, productId, warehouseId, quantity: { $gte: quantity - 1e-9 } },
        { $inc: { quantity: -quantity, version: 1 }, $set: { updatedBy: userId } },
        { new: true, session: asSession(session) },
      ).exec();
      if (!doc) return null;
      return await normalize(doc, session);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async currentBalance(tenantId: string, productId: string, warehouseId: string, session?: TxSession): Promise<number> {
    try {
      const q = StockBalanceModel.findOne({ tenantId, productId, warehouseId });
      const s = asSession(session);
      if (s) q.session(s);
      const doc = await q.exec();
      return doc ? roundQuantity(doc.quantity) : 0;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async insertMovements(movements: Array<Omit<StockMovement, '_id' | 'createdAt'>>, session: TxSession): Promise<StockMovement[]> {
    try {
      const docs = await StockMovementModel.insertMany(movements, { session: asSession(session), ordered: true });
      return (docs as unknown as StockMovementDoc[]).map(toMovement);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async findMovementsByPosting(tenantId: string, postingId: string, session?: TxSession): Promise<StockMovement[]> {
    try {
      const q = StockMovementModel.find({ tenantId, postingId }).sort({ _id: 1 });
      const s = asSession(session);
      if (s) q.session(s);
      return (await q.exec()).map(toMovement);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async listMovements(tenantId: string, filters: StockMovementFilters, page: number, limit: number): Promise<Paged<StockMovement>> {
    const filter: FilterQuery<StockMovementDoc> = { tenantId };
    if (filters.productId) filter.productId = filters.productId;
    if (filters.warehouseId) filter.warehouseId = filters.warehouseId;
    if (filters.type) filter.type = filters.type;
    if (filters.sourceType) filter['source.type'] = filters.sourceType;
    if (filters.sourceId) filter['source.id'] = filters.sourceId;
    if (filters.postingId) filter.postingId = filters.postingId;
    try {
      const [docs, total] = await Promise.all([
        StockMovementModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).exec(),
        StockMovementModel.countDocuments(filter).exec(),
      ]);
      return paged(docs.map(toMovement), total, page, limit);
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async listBalances(tenantId: string, filters: StockBalanceFilters, page: number, limit: number): Promise<Paged<StockBalance>> {
    const filter: FilterQuery<StockBalanceDoc> = { tenantId };
    if (filters.productId) filter.productId = filters.productId;
    if (filters.warehouseId) filter.warehouseId = filters.warehouseId;
    if (filters.nonZero) filter.quantity = { $gt: 0 };
    try {
      const [docs, total] = await Promise.all([
        StockBalanceModel.find(filter).sort({ productId: 1, warehouseId: 1 }).skip((page - 1) * limit).limit(limit).exec(),
        StockBalanceModel.countDocuments(filter).exec(),
      ]);
      return paged(docs.map(toBalance), total, page, limit);
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

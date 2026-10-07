/**
 * Per-tenant document numbering (REC-000001, SOL-000001, ...).
 *
 * Atomic $inc on a counter document. Inside a transaction the number is
 * only consumed if the document commits, so folios stay gap-free per tenant
 * except for aborted transactions retried by the driver (acceptable).
 */
import mongoose, { Schema, type ClientSession, type Model } from 'mongoose';
import { mapMongoError } from '@erp/database';
import type { TxSession } from '../modules/tenant/domain/ports';

export interface ISequenceStore {
  next(tenantId: string, key: string, session?: TxSession): Promise<number>;
}

export function formatFolio(prefix: string, value: number, width = 6): string {
  return `${prefix}-${String(value).padStart(width, '0')}`;
}

interface CounterDoc extends mongoose.Document {
  tenantId: string;
  key: string;
  seq: number;
}

const counterSchema = new Schema<CounterDoc>(
  {
    tenantId: { type: String, required: true },
    key: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: 'counters', versionKey: false },
);
counterSchema.index({ tenantId: 1, key: 1 }, { unique: true, name: 'uniq_tenant_counter' });

export const CounterModel: Model<CounterDoc> =
  (mongoose.models.Counter as Model<CounterDoc> | undefined) ?? mongoose.model<CounterDoc>('Counter', counterSchema);

export const sequenceModels = [CounterModel] as unknown as Array<Model<unknown>>;

export class MongoSequenceStore implements ISequenceStore {
  async next(tenantId: string, key: string, session?: TxSession): Promise<number> {
    try {
      const doc = await CounterModel.findOneAndUpdate(
        { tenantId, key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, session: session as ClientSession | undefined },
      ).exec();
      return doc.seq;
    } catch (err) {
      throw mapMongoError(err);
    }
  }
}

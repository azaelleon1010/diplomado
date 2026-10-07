/**
 * Idempotency for critical writes (AGENTS.md §21).
 *
 * A client sends a unique key per logical operation. The key is reserved
 * inside the same MongoDB transaction as the business writes, so either both
 * commit or neither does. A retry with the same key and payload returns the
 * stored result; the same key with a different payload is rejected (409).
 */
import { createHash } from 'node:crypto';
import mongoose, { Schema, type Model } from 'mongoose';
import { AppError } from '@erp/errors';
import { mapMongoError } from '@erp/database';
import type { ClientSession } from 'mongoose';
import type { TxSession } from '../modules/tenant/domain/ports';

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface IdempotencyRecord {
  tenantId: string;
  scope: string;
  key: string;
  requestHash: string;
  resultRef: string;
}

export interface IIdempotencyStore {
  find(tenantId: string, scope: string, key: string, session?: TxSession): Promise<IdempotencyRecord | null>;
  /** Throws when (tenantId, scope, key) already exists. */
  save(record: IdempotencyRecord & { createdBy: string }, session: TxSession): Promise<void>;
}

/** Stable hash of the meaningful request payload (key order independent). */
export function hashRequest(payload: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = canonical((value as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return value;
  };
  return createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
}

export function idempotencyConflict(): AppError {
  return new AppError({
    code: 'IDEMPOTENCY_CONFLICT',
    message: 'This idempotency key was already used with a different request',
    statusCode: 409,
  });
}

interface IdempotencyDoc extends mongoose.Document {
  tenantId: string;
  scope: string;
  key: string;
  requestHash: string;
  resultRef: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
}

const idempotencySchema = new Schema<IdempotencyDoc>(
  {
    tenantId: { type: String, required: true, trim: true },
    scope: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    requestHash: { type: String, required: true },
    resultRef: { type: String, required: true },
    createdBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'idempotencyKeys', timestamps: { createdAt: 'createdAt', updatedAt: false }, versionKey: false },
);
idempotencySchema.index({ tenantId: 1, scope: 1, key: 1 }, { unique: true, name: 'uniq_tenant_scope_key' });
idempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_expires_at' });

export const IdempotencyModel: Model<IdempotencyDoc> =
  (mongoose.models.IdempotencyKey as Model<IdempotencyDoc> | undefined) ??
  mongoose.model<IdempotencyDoc>('IdempotencyKey', idempotencySchema);

export const sharedModels = [IdempotencyModel] as unknown as Array<Model<unknown>>;

export class MongoIdempotencyStore implements IIdempotencyStore {
  async find(tenantId: string, scope: string, key: string, session?: TxSession): Promise<IdempotencyRecord | null> {
    try {
      const q = IdempotencyModel.findOne({ tenantId, scope, key });
      if (session) q.session(session as ClientSession);
      const doc = await q.lean().exec();
      return doc
        ? { tenantId: doc.tenantId, scope: doc.scope, key: doc.key, requestHash: doc.requestHash, resultRef: doc.resultRef }
        : null;
    } catch (err) {
      throw mapMongoError(err);
    }
  }

  async save(record: IdempotencyRecord & { createdBy: string }, session: TxSession): Promise<void> {
    await IdempotencyModel.create([{ ...record, expiresAt: new Date(Date.now() + RETENTION_MS) }], {
      session: session as ClientSession,
    });
  }
}

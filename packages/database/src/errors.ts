import mongoose from 'mongoose';
import { AppError } from '@erp/errors';

/**
 * Map low-level Mongo/Mongoose errors to business AppErrors.
 * Never leak raw E11000 or stack to client.
 */
export function mapMongoError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  // Duplicate key (unique index)
  if (isMongoDuplicateKey(err)) {
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue;
    const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
    const fields = keyValue ?? keyPattern ?? {};
    const fieldNames = Object.keys(fields).join(', ') || 'unique field';
    return new AppError({
      code: 'CONFLICT',
      message: `Duplicate value for ${fieldNames}`,
      statusCode: 409,
      fields: { duplicateFields: fields },
    });
  }

  // Validation
  if (err instanceof mongoose.Error.ValidationError) {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(err.errors)) fields[k] = (v as { message: string }).message;
    return new AppError({ code: 'VALIDATION_ERROR', message: 'Validation failed', statusCode: 400, fields });
  }

  // CastError (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    return new AppError({ code: 'VALIDATION_ERROR', message: `Invalid value for ${err.path}: ${err.value}`, statusCode: 400, fields: { path: err.path } });
  }

  // Version conflict (optimistic concurrency)
  if (isVersionError(err)) {
    return new AppError({ code: 'VERSION_CONFLICT', message: 'Document was modified by another request. Please reload and retry.', statusCode: 409 });
  }

  // Timeout / unavailable
  if (isTimeoutError(err)) {
    return new AppError({ code: 'INTERNAL_ERROR', message: 'Database temporarily unavailable', statusCode: 503 });
  }

  const message = err instanceof Error ? err.message : 'Database error';
  return new AppError({ code: 'INTERNAL_ERROR', message, statusCode: 500 });
}

function isMongoDuplicateKey(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  return e.code === 11000 || e.code === 11001 || (typeof e.message === 'string' && e.message.includes('E11000'));
}

function isVersionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  return e.name === 'VersionError' || e.name === 'OptimisticConcurrencyError';
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  const msg = (e.message as string) || '';
  return msg.includes('ServerSelectionTimeout') || msg.includes('timed out') || e.name === 'MongooseServerSelectionError';
}

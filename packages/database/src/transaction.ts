import mongoose from 'mongoose';
import { createLogger } from '@erp/logger';

const logger = createLogger('database:transaction');

export interface TxOptions {
  readConcern?: string;
  writeConcern?: string;
  maxTimeMS?: number;
}

/**
 * Run callback inside a MongoDB transaction.
 * Caller receives ClientSession to pass to repositories.
 * Retries not included — driver handles transient retryWrites.
 */
export async function withTransaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>, opts: TxOptions = {}): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    }, {
      readConcern: opts.readConcern ? { level: opts.readConcern as 'snapshot' } : undefined,
      writeConcern: opts.writeConcern ? { w: opts.writeConcern as 'majority' } : { w: 'majority' },
      maxTimeMS: opts.maxTimeMS,
    });
    logger.debug('transaction committed');
    return result as T;
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'transaction aborted');
    throw err;
  } finally {
    await session.endSession();
  }
}

/**
 * Helper to optionally attach session to Mongoose queries.
 * Usage: query.session(sessionIfPresent)
 */
export function sessionOrNull(session?: mongoose.ClientSession | null): mongoose.ClientSession | null {
  return session ?? null;
}

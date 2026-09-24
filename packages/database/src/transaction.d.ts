import mongoose from 'mongoose';
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
export declare function withTransaction<T>(fn: (session: mongoose.ClientSession) => Promise<T>, opts?: TxOptions): Promise<T>;
/**
 * Helper to optionally attach session to Mongoose queries.
 * Usage: query.session(sessionIfPresent)
 */
export declare function sessionOrNull(session?: mongoose.ClientSession | null): mongoose.ClientSession | null;
//# sourceMappingURL=transaction.d.ts.map
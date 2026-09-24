/**
 * Index strategy — documents why each index exists.
 * Indexes are created via Mongoose `schema.index()` and applied on connect (autoIndex in dev).
 * In production, run `ensureIndexes()` or rely on migrations.
 */
import type { Model } from 'mongoose';
export interface IndexSpec {
    collection: string;
    keys: Record<string, 1 | -1 | 'text'>;
    options?: Record<string, unknown>;
    reason: string;
    queryPattern: string;
}
/**
 * Base indexes every tenant-scoped collection SHOULD consider.
 * Collections opt-in; not auto-applied to avoid index explosion.
 */
export declare const baseIndexSpecs: IndexSpec[];
export declare const exampleIndexesForFutureModules: IndexSpec[];
export declare function ensureIndexes(models: Model<unknown>[]): Promise<void>;
export declare function logIndexCatalog(): void;
//# sourceMappingURL=indexes.d.ts.map
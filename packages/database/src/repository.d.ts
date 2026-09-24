/**
 * Base Repository — tenant isolation + common CRUD.
 * Business modules extend this, never query Mongoose directly from controllers.
 */
import type { FilterQuery, Model, ClientSession } from 'mongoose';
export interface TenantContext {
    tenantId: string;
    organizationId?: string;
    branchId?: string;
    userId: string;
}
export interface Pagination {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export declare abstract class BaseRepository<T extends {
    _id: unknown;
    tenantId: string;
    version: number;
}> {
    protected readonly model: Model<T>;
    constructor(model: Model<T>);
    protected tenantFilter(ctx: TenantContext, extra?: FilterQuery<T>): FilterQuery<T>;
    /** tenant-scoped findOne */
    findById(id: string, ctx: TenantContext, session?: ClientSession): Promise<T | null>;
    /** tenant-scoped find with pagination */
    findMany(filter: FilterQuery<T>, ctx: TenantContext, pagination?: Pagination, session?: ClientSession): Promise<{
        data: T[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    create(doc: Partial<T>, ctx: TenantContext, session?: ClientSession): Promise<T>;
    /**
     * Optimistic concurrency update: requires expectedVersion, increments version.
     * Throws VERSION_CONFLICT if stale.
     */
    updateById(id: string, patch: Partial<T>, ctx: TenantContext, expectedVersion: number, session?: ClientSession): Promise<T>;
    deleteById(_id: string, _ctx: TenantContext): Promise<void>;
}
//# sourceMappingURL=repository.d.ts.map
/**
 * Base Repository — tenant isolation + common CRUD.
 * Business modules extend this, never query Mongoose directly from controllers.
 */
import type { FilterQuery, Model, ClientSession } from 'mongoose';
import { mapMongoError } from './errors';

export interface TenantContext {
  tenantId: string;
  organizationId?: string;
  branchId?: string;
  userId: string; // for audit fields
}

export interface Pagination {
  page: number; // 1-based
  limit: number; // 1..100
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export abstract class BaseRepository<T extends { _id: unknown; tenantId: string; version: number }> {
  constructor(protected readonly model: Model<T>) {}

  protected tenantFilter(ctx: TenantContext, extra: FilterQuery<T> = {}): FilterQuery<T> {
    if (!ctx.tenantId) throw new Error('tenantId is required in TenantContext');
    return { tenantId: ctx.tenantId, ...extra } as FilterQuery<T>;
  }

  /** tenant-scoped findOne */
  async findById(id: string, ctx: TenantContext, session?: ClientSession): Promise<T | null> {
    const filter = this.tenantFilter(ctx, { _id: id } as FilterQuery<T>);
    try {
      const q = this.model.findOne(filter);
      if (session) q.session(session);
      return (await q.exec()) as T | null;
    } catch (err) { throw mapMongoError(err); }
  }

  /** tenant-scoped find with pagination */
  async findMany(filter: FilterQuery<T>, ctx: TenantContext, pagination: Pagination = { page: 1, limit: 20 }, session?: ClientSession) {
    const f = this.tenantFilter(ctx, filter);
    const page = Math.max(1, pagination.page);
    const limit = Math.min(100, Math.max(1, pagination.limit));
    const sort: Record<string, 1 | -1> = { createdAt: -1 };
    if (pagination.sortBy) sort[pagination.sortBy] = pagination.sortOrder === 'asc' ? 1 : -1;
    try {
      const q = this.model.find(f).sort(sort).skip((page - 1) * limit).limit(limit);
      if (session) q.session(session);
      const [data, total] = await Promise.all([q.exec(), this.model.countDocuments(f).exec()]);
      return { data: data as T[], total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (err) { throw mapMongoError(err); }
  }

  async create(doc: Partial<T>, ctx: TenantContext, session?: ClientSession): Promise<T> {
    const payload = {
      ...doc,
      tenantId: ctx.tenantId,
      organizationId: (doc as { organizationId?: string }).organizationId ?? ctx.organizationId,
      branchId: (doc as { branchId?: string }).branchId ?? ctx.branchId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };
    try {
      const [created] = await this.model.create([payload], session ? { session } : {});
      return created as T;
    } catch (err) { throw mapMongoError(err); }
  }

  /**
   * Optimistic concurrency update: requires expectedVersion, increments version.
   * Throws VERSION_CONFLICT if stale.
   */
  async updateById(id: string, patch: Partial<T>, ctx: TenantContext, expectedVersion: number, session?: ClientSession): Promise<T> {
    const filter = this.tenantFilter(ctx, { _id: id, version: expectedVersion } as unknown as FilterQuery<T>);
    try {
      const updated = await this.model.findOneAndUpdate(
        filter,
        { $set: { ...patch, updatedBy: ctx.userId, updatedAt: new Date() }, $inc: { version: 1 } },
        { new: true, session, runValidators: true }
      ).exec();
      if (!updated) {
        // distinguish not-found vs version conflict
        const exists = await this.model.findOne(this.tenantFilter(ctx, { _id: id } as FilterQuery<T>)).session(session ?? null).exec();
        if (exists) throw mapMongoError(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
        throw new (await import('@erp/errors')).AppError({ code: 'NOT_FOUND', message: 'Document not found', statusCode: 404 });
      }
      return updated as T;
    } catch (err) { throw mapMongoError(err); }
  }

  async deleteById(_id: string, _ctx: TenantContext): Promise<void> {
    // Soft-delete preferred for ERP — placeholder to enforce review before hard delete
    throw new Error('Hard delete not allowed. Implement soft-delete or archival via status.');
  }
}

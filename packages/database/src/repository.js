"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseRepository = void 0;
const errors_1 = require("./errors");
class BaseRepository {
    model;
    constructor(model) {
        this.model = model;
    }
    tenantFilter(ctx, extra = {}) {
        if (!ctx.tenantId)
            throw new Error('tenantId is required in TenantContext');
        return { tenantId: ctx.tenantId, ...extra };
    }
    /** tenant-scoped findOne */
    async findById(id, ctx, session) {
        const filter = this.tenantFilter(ctx, { _id: id });
        try {
            const q = this.model.findOne(filter);
            if (session)
                q.session(session);
            return (await q.exec());
        }
        catch (err) {
            throw (0, errors_1.mapMongoError)(err);
        }
    }
    /** tenant-scoped find with pagination */
    async findMany(filter, ctx, pagination = { page: 1, limit: 20 }, session) {
        const f = this.tenantFilter(ctx, filter);
        const page = Math.max(1, pagination.page);
        const limit = Math.min(100, Math.max(1, pagination.limit));
        const sort = { createdAt: -1 };
        if (pagination.sortBy)
            sort[pagination.sortBy] = pagination.sortOrder === 'asc' ? 1 : -1;
        try {
            const q = this.model.find(f).sort(sort).skip((page - 1) * limit).limit(limit);
            if (session)
                q.session(session);
            const [data, total] = await Promise.all([q.exec(), this.model.countDocuments(f).exec()]);
            return { data: data, total, page, limit, totalPages: Math.ceil(total / limit) };
        }
        catch (err) {
            throw (0, errors_1.mapMongoError)(err);
        }
    }
    async create(doc, ctx, session) {
        const payload = {
            ...doc,
            tenantId: ctx.tenantId,
            organizationId: doc.organizationId ?? ctx.organizationId,
            branchId: doc.branchId ?? ctx.branchId,
            createdBy: ctx.userId,
            updatedBy: ctx.userId,
        };
        try {
            const [created] = await this.model.create([payload], session ? { session } : {});
            return created;
        }
        catch (err) {
            throw (0, errors_1.mapMongoError)(err);
        }
    }
    /**
     * Optimistic concurrency update: requires expectedVersion, increments version.
     * Throws VERSION_CONFLICT if stale.
     */
    async updateById(id, patch, ctx, expectedVersion, session) {
        const filter = this.tenantFilter(ctx, { _id: id, version: expectedVersion });
        try {
            const updated = await this.model.findOneAndUpdate(filter, { $set: { ...patch, updatedBy: ctx.userId, updatedAt: new Date() }, $inc: { version: 1 } }, { new: true, session, runValidators: true }).exec();
            if (!updated) {
                // distinguish not-found vs version conflict
                const exists = await this.model.findOne(this.tenantFilter(ctx, { _id: id })).session(session ?? null).exec();
                if (exists)
                    throw (0, errors_1.mapMongoError)(Object.assign(new Error('Version conflict'), { name: 'VersionError' }));
                throw new (await Promise.resolve().then(() => __importStar(require('@erp/errors')))).AppError({ code: 'NOT_FOUND', message: 'Document not found', statusCode: 404 });
            }
            return updated;
        }
        catch (err) {
            throw (0, errors_1.mapMongoError)(err);
        }
    }
    async deleteById(_id, _ctx) {
        // Soft-delete preferred for ERP — placeholder to enforce review before hard delete
        throw new Error('Hard delete not allowed. Implement soft-delete or archival via status.');
    }
}
exports.BaseRepository = BaseRepository;
//# sourceMappingURL=repository.js.map
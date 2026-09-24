"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exampleIndexesForFutureModules = exports.baseIndexSpecs = void 0;
exports.ensureIndexes = ensureIndexes;
exports.logIndexCatalog = logIndexCatalog;
const logger_1 = require("@erp/logger");
const logger = (0, logger_1.createLogger)('database:indexes');
/**
 * Base indexes every tenant-scoped collection SHOULD consider.
 * Collections opt-in; not auto-applied to avoid index explosion.
 */
exports.baseIndexSpecs = [
    {
        collection: '* (tenant-scoped)',
        keys: { tenantId: 1, _id: 1 },
        reason: 'Tenant isolation + primary lookup. Every findOne({ _id, tenantId }) hits this.',
        queryPattern: 'findOne({ _id, tenantId })',
    },
    {
        collection: '* (tenant-scoped)',
        keys: { tenantId: 1, createdAt: -1 },
        reason: 'Pagination by recency per tenant.',
        queryPattern: 'find({ tenantId }).sort({ createdAt: -1 }).limit()',
    },
    {
        collection: '* (tenant-scoped)',
        keys: { tenantId: 1, status: 1, createdAt: -1 },
        reason: 'Filtered lists by status per tenant.',
        queryPattern: 'find({ tenantId, status }).sort({ createdAt: -1 })',
    },
];
exports.exampleIndexesForFutureModules = [
    {
        collection: 'customers',
        keys: { tenantId: 1, code: 1 },
        options: { unique: true, name: 'uniq_tenant_customer_code' },
        reason: 'Customer code unique per tenant (not globally). Supports duplicate-key mapping.',
        queryPattern: 'findOne({ tenantId, code }) / unique constraint',
    },
    {
        collection: 'customers',
        keys: { tenantId: 1, 'search.text': 'text' },
        reason: 'Enterprise search across name/email (Atlas Search or text index fallback).',
        queryPattern: 'find({ $text: { $search } }) with tenantId filter',
    },
    {
        collection: 'products',
        keys: { tenantId: 1, sku: 1 },
        options: { unique: true, sparse: true },
        reason: 'SKU unique per tenant.',
        queryPattern: 'findOne({ tenantId, sku })',
    },
    {
        collection: 'journalEntries',
        keys: { tenantId: 1, status: 1, postedAt: -1 },
        reason: 'Finance queries by period/status.',
        queryPattern: 'find({ tenantId, status, period }).sort({ postedAt: -1 })',
    },
    {
        collection: 'inventoryMovements',
        keys: { tenantId: 1, productId: 1, warehouseId: 1, createdAt: -1 },
        reason: 'Inventory ledger lookups for balance derivation.',
        queryPattern: 'find({ tenantId, productId, warehouseId }).sort({ createdAt: -1 })',
    },
];
async function ensureIndexes(models) {
    for (const model of models) {
        try {
            await model.syncIndexes();
            logger.info({ collection: model.collection.name }, 'indexes ensured');
        }
        catch (err) {
            logger.error({ err: err.message, collection: model.collection.name }, 'index sync failed');
            throw err;
        }
    }
}
function logIndexCatalog() {
    logger.info({ base: exports.baseIndexSpecs, examples: exports.exampleIndexesForFutureModules }, 'index catalog');
}
//# sourceMappingURL=indexes.js.map
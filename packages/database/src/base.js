"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseOptions = exports.baseFields = void 0;
exports.addTenantIndex = addTenantIndex;
exports.baseFields = {
    tenantId: { type: String, required: true, index: true, trim: true },
    organizationId: { type: String, index: true, sparse: true, trim: true },
    legalEntityId: { type: String, index: true, sparse: true, trim: true },
    branchId: { type: String, index: true, sparse: true, trim: true },
    locationId: { type: String, index: true, sparse: true, trim: true },
    createdBy: { type: String, required: true, trim: true },
    updatedBy: { type: String, required: true, trim: true },
    version: { type: Number, required: true, default: 1, min: 1 },
};
exports.baseOptions = {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
    versionKey: 'version', // use version instead of __v
    optimisticConcurrency: true, // enables VersionError on stale update
    id: true,
};
function addTenantIndex(schema, fields = ['createdAt']) {
    // Common multi-tenant index: tenantId first for isolation, then query fields
    // Individual collections will define their own compound indexes in indexes.ts
    schema.index({ tenantId: 1, ...Object.fromEntries(fields.map((f) => [f, 1])) });
}
//# sourceMappingURL=base.js.map
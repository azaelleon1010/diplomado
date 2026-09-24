import { Schema } from 'mongoose';

/**
 * Base fields for enterprise documents (AGENTS.md §14).
 * tenantId is mandatory for multi-tenant isolation.
 */
export interface BaseDocumentFields {
  _id: string;
  tenantId: string;
  organizationId?: string;
  legalEntityId?: string;
  branchId?: string;
  locationId?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  version: number;
}

export const baseFields: Record<string, unknown> = {
  tenantId: { type: String, required: true, index: true, trim: true },
  organizationId: { type: String, index: true, sparse: true, trim: true },
  legalEntityId: { type: String, index: true, sparse: true, trim: true },
  branchId: { type: String, index: true, sparse: true, trim: true },
  locationId: { type: String, index: true, sparse: true, trim: true },
  createdBy: { type: String, required: true, trim: true },
  updatedBy: { type: String, required: true, trim: true },
  version: { type: Number, required: true, default: 1, min: 1 },
};

export const baseOptions = {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  versionKey: 'version', // use version instead of __v
  optimisticConcurrency: true, // enables VersionError on stale update
  id: true,
};

export function addTenantIndex(schema: Schema, fields: string[] = ['createdAt']): void {
  // Common multi-tenant index: tenantId first for isolation, then query fields
  // Individual collections will define their own compound indexes in indexes.ts
  schema.index({ tenantId: 1, ...Object.fromEntries(fields.map((f) => [f, 1])) });
}

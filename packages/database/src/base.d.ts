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
export declare const baseFields: Record<string, unknown>;
export declare const baseOptions: {
    timestamps: {
        createdAt: string;
        updatedAt: string;
    };
    versionKey: string;
    optimisticConcurrency: boolean;
    id: boolean;
};
export declare function addTenantIndex(schema: Schema, fields?: string[]): void;
//# sourceMappingURL=base.d.ts.map
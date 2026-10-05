/**
 * Production request DTOs — Zod strict schemas.
 * Unknown fields are rejected. tenantId/createdBy/updatedBy are never
 * accepted from the client; they come from the authenticated context.
 * Finished-good and material products must exist in the inventory catalog.
 */
import { z } from 'zod';

const orderStatusRule = z.enum(['DRAFT', 'RELEASED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED']);

const materialRule = z.object({
  productId: z.string().trim().min(1).max(120),
  quantityRequired: z.number().finite().min(0).max(1_000_000_000),
  quantityConsumed: z.number().finite().min(0).max(1_000_000_000).optional(),
});

export const createProductionOrderSchema = z
  .object({
    code: z.string().trim().min(1).max(32),
    productId: z.string().trim().min(1).max(120),
    quantity: z.number().finite().min(0).max(1_000_000_000),
    machine: z.string().trim().max(200).optional(),
    responsible: z.string().trim().max(200).optional(),
    dueDate: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(2000).optional(),
    materials: z.array(materialRule).max(200).default([]),
  })
  .strict();

export const updateProductionOrderSchema = z
  .object({
    quantity: z.number().finite().min(0).max(1_000_000_000).optional(),
    machine: z.string().trim().max(200).nullable().optional(),
    responsible: z.string().trim().max(200).nullable().optional(),
    dueDate: z.string().trim().max(30).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    materials: z.array(materialRule).max(200).optional(),
    // NOTE: versions are 0-based at runtime (Mongoose optimisticConcurrency
    // manages versionKey starting at 0), so 0 must be accepted here.
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const transitionProductionOrderSchema = z
  .object({
    to: z.enum(['RELEASED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED']),
    expectedVersion: z.number().int().min(0),
    producedQuantity: z.number().finite().min(0).max(1_000_000_000).optional(),
    materials: z.array(materialRule).max(200).optional(),
  })
  .strict();

export const productionOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  productId: z.string().trim().min(1).max(120).optional(),
  status: orderStatusRule.optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const productionIdParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

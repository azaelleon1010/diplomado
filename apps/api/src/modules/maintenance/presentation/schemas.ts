/**
 * Maintenance request DTOs — Zod strict schemas.
 * Unknown fields are rejected. tenantId/createdBy/updatedBy are never
 * accepted from the client; they come from the authenticated context.
 */
import { z } from 'zod';

const assetStatusRule = z.enum(['ACTIVE', 'IN_MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED']);
const orderStatusRule = z.enum(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']);
const orderTypeRule = z.enum(['PREVENTIVE', 'CORRECTIVE']);
const priorityRule = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const moneyRule = z.number().finite().min(0).max(1_000_000_000);
const dateRule = z.string().trim().max(30);

export const createAssetSchema = z
  .object({
    code: z.string().trim().min(1).max(32),
    name: z.string().trim().min(2).max(200),
    type: z.string().trim().min(2).max(80),
    location: z.string().trim().max(200).optional(),
    responsible: z.string().trim().max(200).optional(),
    purchaseDate: dateRule.optional(),
    warrantyUntil: dateRule.optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const updateAssetSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    type: z.string().trim().min(2).max(80).optional(),
    location: z.string().trim().max(200).nullable().optional(),
    responsible: z.string().trim().max(200).nullable().optional(),
    purchaseDate: dateRule.nullable().optional(),
    warrantyUntil: dateRule.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    status: assetStatusRule.optional(),
    // NOTE: versions are 0-based at runtime (Mongoose optimisticConcurrency
    // manages versionKey starting at 0), so 0 must be accepted here.
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const createOrderSchema = z
  .object({
    assetId: z.string().trim().min(1).max(120),
    type: orderTypeRule,
    priority: priorityRule,
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    scheduledFor: dateRule.optional(),
    cost: moneyRule.default(0),
    assignedTo: z.string().trim().max(200).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const updateOrderSchema = z
  .object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    priority: priorityRule.optional(),
    scheduledFor: dateRule.nullable().optional(),
    cost: moneyRule.optional(),
    assignedTo: z.string().trim().max(200).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const transitionOrderSchema = z
  .object({
    to: z.enum(['IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']),
    expectedVersion: z.number().int().min(0),
    completedCost: moneyRule.optional(),
  })
  .strict();

export const assetQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: assetStatusRule.optional(),
  type: z.string().trim().max(80).optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  assetId: z.string().trim().min(1).max(120).optional(),
  status: orderStatusRule.optional(),
  priority: priorityRule.optional(),
  type: orderTypeRule.optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const idParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

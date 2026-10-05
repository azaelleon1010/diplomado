/**
 * Inventory request DTOs — Zod strict schemas.
 * Unknown fields are rejected. tenantId/createdBy/updatedBy are never
 * accepted from the client; they come from the authenticated context.
 */
import { z } from 'zod';

const statusRule = z.enum(['ACTIVE', 'INACTIVE']);

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    status: statusRule.optional(),
    // NOTE: versions are 0-based at runtime (Mongoose optimisticConcurrency
    // manages versionKey starting at 0), so 0 must be accepted here.
    expectedVersion: z.number().int().min(0),
  })
  .strict();

const unitRule = z.string().trim().min(1).max(20);
const moneyRule = z.number().finite().min(0).max(1_000_000_000);
const stockRule = z.number().int().min(0).max(1_000_000_000);

export const createProductSchema = z
  .object({
    sku: z.string().trim().min(1).max(64),
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(1000).optional(),
    categoryId: z.string().trim().min(1).max(120).optional(),
    unit: unitRule,
    barcode: z.string().trim().max(64).optional(),
    cost: moneyRule,
    price: moneyRule,
    minimumStock: stockRule.default(0),
    maximumStock: z.number().int().min(0).max(1_000_000_000).optional(),
    trackInventory: z.boolean().default(true),
  })
  .strict()
  .refine((v) => v.maximumStock === undefined || v.maximumStock >= v.minimumStock, {
    message: 'maximumStock cannot be less than minimumStock',
    path: ['maximumStock'],
  });

export const updateProductSchema = z
  .object({
    sku: z.string().trim().min(1).max(64).optional(),
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    categoryId: z.string().trim().min(1).max(120).nullable().optional(),
    unit: unitRule.optional(),
    barcode: z.string().trim().max(64).nullable().optional(),
    cost: moneyRule.optional(),
    price: moneyRule.optional(),
    minimumStock: stockRule.optional(),
    maximumStock: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    trackInventory: z.boolean().optional(),
    status: statusRule.optional(),
    // NOTE: versions are 0-based at runtime (Mongoose optimisticConcurrency
    // manages versionKey starting at 0), so 0 must be accepted here.
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const createWarehouseSchema = z
  .object({
    code: z.string().trim().min(1).max(32),
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().max(500).optional(),
    address: z.string().trim().max(300).optional(),
  })
  .strict();

export const updateWarehouseSchema = z
  .object({
    code: z.string().trim().min(1).max(32).optional(),
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(500).optional(),
    address: z.string().trim().max(300).optional(),
    status: statusRule.optional(),
    // NOTE: versions are 0-based at runtime (Mongoose optimisticConcurrency
    // manages versionKey starting at 0), so 0 must be accepted here.
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const inventoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  categoryId: z.string().trim().min(1).max(120).optional(),
  status: statusRule.optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const idParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

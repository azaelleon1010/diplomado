/**
 * Inventory request DTOs — Zod strict schemas.
 * Unknown fields are rejected. tenantId/createdBy/updatedBy are never
 * accepted from the client; they come from the authenticated context.
 */
import { z } from 'zod';
import { reportFormatSchema } from '../../../shared/reports/http';

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

// ---------------------------------------------------------------------------
// Inventory ledger (stock balances, movements, transfers)
// ---------------------------------------------------------------------------

const idRule = z.string().trim().min(1).max(120);
const quantityRule = z.number().positive().max(1_000_000_000);
const idempotencyKeyRule = z.string().trim().regex(/^[A-Za-z0-9._:-]{8,128}$/, 'idempotencyKey must be 8-128 chars: letters, digits, . _ : -');

export const manualMovementTypeRule = z.enum(['RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT']);

export const postMovementsSchema = z
  .object({
    lines: z
      .array(
        z
          .object({
            productId: idRule,
            warehouseId: idRule,
            type: manualMovementTypeRule,
            quantity: quantityRule,
            unitCost: z.number().finite().min(0).max(1_000_000_000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional(),
    idempotencyKey: idempotencyKeyRule,
  })
  .strict();

export const transferSchema = z
  .object({
    productId: idRule,
    fromWarehouseId: idRule,
    toWarehouseId: idRule,
    quantity: quantityRule,
    reference: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional(),
    idempotencyKey: idempotencyKeyRule,
  })
  .strict();

export const stockQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  productId: idRule.optional(),
  warehouseId: idRule.optional(),
  nonZero: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});

export const movementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  productId: idRule.optional(),
  warehouseId: idRule.optional(),
  type: z.enum(['RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT']).optional(),
  sourceType: z.string().trim().max(40).optional(),
  sourceId: idRule.optional(),
  postingId: idRule.optional(),
});

// ---------------------------------------------------------------------------
// Reports (CSV / PDF) — same filters as the list endpoints, no pagination cap.
// ---------------------------------------------------------------------------

export const stockReportQuerySchema = z.object({
  format: reportFormatSchema,
  warehouseId: idRule.optional(),
  categoryId: idRule.optional(),
  status: statusRule.optional(),
  nonZero: z.enum(['true', 'false']).optional().transform((v) => (v === undefined ? true : v === 'true')),
});

export const movementsReportQuerySchema = z.object({
  format: reportFormatSchema,
  productId: idRule.optional(),
  warehouseId: idRule.optional(),
  type: z.enum(['RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT']).optional(),
  sourceType: z.string().trim().max(40).optional(),
});

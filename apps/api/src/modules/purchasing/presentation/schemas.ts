/**
 * Purchasing request DTOs — Zod strict schemas.
 * Unknown fields are rejected. tenantId/createdBy/updatedBy are never
 * accepted from the client; they come from the authenticated context.
 * Products always come from the inventory catalog (never duplicated).
 */
import { z } from 'zod';

const supplierStatusRule = z.enum(['ACTIVE', 'INACTIVE']);
const orderStatusRule = z.enum(['DRAFT', 'SENT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']);
const moneyRule = z.number().finite().min(0).max(1_000_000_000);
const daysRule = z.number().int().min(0).max(365);
const currencyRule = z.string().trim().regex(/^[A-Za-z]{3}$/, 'currency must be an ISO 4217 code (e.g. MXN)');
const contactRule = z
  .object({
    name: z.string().trim().min(1).max(200),
    email: z.string().trim().max(254).optional(),
    phone: z.string().trim().max(40).optional(),
    role: z.string().trim().max(100).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export const createSupplierSchema = z
  .object({
    code: z.string().trim().min(1).max(32),
    name: z.string().trim().min(2).max(200),
    contactName: z.string().trim().max(200).optional(),
    email: z.string().trim().max(254).optional(),
    phone: z.string().trim().max(40).optional(),
    address: z.string().trim().max(300).optional(),
    taxId: z.string().trim().max(40).optional(),
    paymentTermsDays: daysRule.optional(),
    currency: currencyRule.optional(),
    leadTimeDays: daysRule.optional(),
    contacts: z.array(contactRule).max(20).optional(),
  })
  .strict();

export const updateSupplierSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    contactName: z.string().trim().max(200).nullable().optional(),
    email: z.string().trim().max(254).nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    taxId: z.string().trim().max(40).nullable().optional(),
    paymentTermsDays: daysRule.optional(),
    currency: currencyRule.optional(),
    leadTimeDays: daysRule.nullable().optional(),
    contacts: z.array(contactRule).max(20).optional(),
    status: supplierStatusRule.optional(),
    // NOTE: versions are 0-based at runtime (Mongoose optimisticConcurrency
    // manages versionKey starting at 0), so 0 must be accepted here.
    expectedVersion: z.number().int().min(0),
  })
  .strict();

const purchaseLineRule = z.object({
  productId: z.string().trim().min(1).max(120),
  quantity: z.number().finite().min(0).max(1_000_000_000),
  unitCost: moneyRule,
});

const receiveLineRule = z.object({
  productId: z.string().trim().min(1).max(120),
  quantityReceived: z.number().finite().min(0).max(1_000_000_000),
});

export const createPurchaseOrderSchema = z
  .object({
    folio: z.string().trim().min(1).max(32),
    supplierId: z.string().trim().min(1).max(120),
    expectedDate: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(2000).optional(),
    lines: z.array(purchaseLineRule).min(1).max(200),
  })
  .strict();

export const updatePurchaseOrderSchema = z
  .object({
    expectedDate: z.string().trim().max(30).nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    lines: z.array(purchaseLineRule).min(1).max(200).optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const transitionPurchaseOrderSchema = z
  .object({
    to: z.enum(['SENT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']),
    expectedVersion: z.number().int().min(0),
    lines: z.array(receiveLineRule).max(200).optional(),
  })
  .strict();

export const supplierQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: supplierStatusRule.optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const purchaseOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  supplierId: z.string().trim().min(1).max(120).optional(),
  status: orderStatusRule.optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const receiveOrderSchema = z
  .object({
    warehouseId: z.string().trim().min(1).max(120),
    lines: z
      .array(
        z
          .object({
            productId: z.string().trim().min(1).max(120),
            quantity: z.number().positive().max(1_000_000_000),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    notes: z.string().trim().max(1000).optional(),
    idempotencyKey: z.string().trim().regex(/^[A-Za-z0-9._:-]{8,128}$/, 'idempotencyKey must be 8-128 chars: letters, digits, . _ : -'),
  })
  .strict();

export const receiptQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  purchaseOrderId: z.string().trim().min(1).max(120).optional(),
  supplierId: z.string().trim().min(1).max(120).optional(),
  warehouseId: z.string().trim().min(1).max(120).optional(),
});

const requestLineRule = z
  .object({
    productId: z.string().trim().min(1).max(120),
    quantity: z.number().positive().max(1_000_000_000),
    notes: z.string().trim().max(300).optional(),
  })
  .strict();

export const createRequestSchema = z
  .object({
    department: z.string().trim().max(120).optional(),
    neededBy: z.string().trim().max(30).optional(),
    justification: z.string().trim().max(1000).optional(),
    lines: z.array(requestLineRule).min(1).max(200),
  })
  .strict();

export const updateRequestSchema = z
  .object({
    department: z.string().trim().max(120).nullable().optional(),
    neededBy: z.string().trim().max(30).nullable().optional(),
    justification: z.string().trim().max(1000).nullable().optional(),
    lines: z.array(requestLineRule).min(1).max(200).optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const versionSchema = z.object({ expectedVersion: z.number().int().min(0) }).strict();

export const decideRequestSchema = z
  .object({
    decision: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().trim().max(500).optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const convertRequestSchema = z
  .object({
    supplierId: z.string().trim().min(1).max(120),
    folio: z.string().trim().min(1).max(32).optional(),
    expectedDate: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(2000).optional(),
    lines: z
      .array(
        z
          .object({
            productId: z.string().trim().min(1).max(120),
            unitCost: moneyRule,
            quantity: z.number().positive().max(1_000_000_000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const createQuoteSchema = z
  .object({
    supplierId: z.string().trim().min(1).max(120),
    currency: currencyRule.optional(),
    validUntil: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(1000).optional(),
    lines: z
      .array(
        z
          .object({
            productId: z.string().trim().min(1).max(120),
            unitCost: moneyRule,
            quantity: z.number().positive().max(1_000_000_000).optional(),
            leadTimeDays: daysRule.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export const awardQuoteSchema = z
  .object({
    folio: z.string().trim().min(1).max(32).optional(),
    expectedDate: z.string().trim().max(30).optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const requestQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ORDERED', 'CANCELLED']).optional(),
  mine: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});

export const purchasingIdParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

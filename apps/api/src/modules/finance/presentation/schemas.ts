/**
 * Finance request DTOs — Zod strict schemas.
 * Unknown fields are rejected. tenantId/createdBy/updatedBy are never
 * accepted from the client; they come from the authenticated context.
 */
import { z } from 'zod';

const accountTypeRule = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);
const accountStatusRule = z.enum(['ACTIVE', 'INACTIVE']);
const categoryKindRule = z.enum(['INCOME', 'EXPENSE']);
const movementKindRule = z.enum(['INCOME', 'EXPENSE']);
const movementStatusRule = z.enum(['POSTED', 'VOIDED']);
const paymentMethodRule = z.enum(['CASH', 'TRANSFER', 'CARD', 'OTHER']);
const moneyRule = z.number().finite().min(0).max(1_000_000_000_000);
const dateRule = z.string().trim().max(30);

export const createAccountSchema = z
  .object({
    code: z.string().trim().min(1).max(16),
    name: z.string().trim().min(2).max(200),
    type: accountTypeRule,
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().max(500).optional(),
    status: accountStatusRule.optional(),
    // NOTE: versions are 0-based at runtime (Mongoose optimisticConcurrency
    // manages versionKey starting at 0), so 0 must be accepted here.
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const createFinanceCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    kind: categoryKindRule,
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateFinanceCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    status: accountStatusRule.optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const createMovementSchema = z
  .object({
    accountId: z.string().trim().min(1).max(120),
    categoryId: z.string().trim().min(1).max(120).optional(),
    kind: movementKindRule,
    amount: moneyRule,
    method: paymentMethodRule,
    concept: z.string().trim().min(2).max(300),
    reference: z.string().trim().max(120).optional(),
    date: dateRule,
  })
  .strict();

export const voidMovementSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const accountQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  type: accountTypeRule.optional(),
  status: accountStatusRule.optional(),
});

export const financeCategoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  kind: categoryKindRule.optional(),
  status: accountStatusRule.optional(),
});

export const movementQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  accountId: z.string().trim().min(1).max(120).optional(),
  categoryId: z.string().trim().min(1).max(120).optional(),
  kind: movementKindRule.optional(),
  status: movementStatusRule.optional(),
  dateFrom: dateRule.optional(),
  dateTo: dateRule.optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const totalsQuerySchema = z.object({
  accountId: z.string().trim().min(1).max(120).optional(),
  dateFrom: dateRule.optional(),
  dateTo: dateRule.optional(),
});

export const financeIdParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

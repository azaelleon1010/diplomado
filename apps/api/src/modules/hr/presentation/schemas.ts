/**
 * HR request DTOs — Zod strict schemas.
 * Unknown fields are rejected. tenantId/createdBy/updatedBy are never
 * accepted from the client; they come from the authenticated context.
 */
import { z } from 'zod';

const departmentStatusRule = z.enum(['ACTIVE', 'INACTIVE']);
const employeeStatusRule = z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE']);
const timeOffTypeRule = z.enum(['VACATION', 'SICK', 'PERMISSION']);
const timeOffStatusRule = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
const dateRule = z.string().trim().max(30);
const emailRule = z.string().trim().max(254);

export const createDepartmentSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional(),
  })
  .strict();

export const updateDepartmentSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    status: departmentStatusRule.optional(),
    // NOTE: versions are 0-based at runtime (Mongoose optimisticConcurrency
    // manages versionKey starting at 0), so 0 must be accepted here.
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const createEmployeeSchema = z
  .object({
    code: z.string().trim().min(1).max(32),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: emailRule.optional(),
    phone: z.string().trim().max(40).optional(),
    departmentId: z.string().trim().min(1).max(120).optional(),
    position: z.string().trim().max(120).optional(),
    location: z.string().trim().max(200).optional(),
    hireDate: dateRule.optional(),
  })
  .strict();

export const updateEmployeeSchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    email: emailRule.nullable().optional(),
    phone: z.string().trim().max(40).nullable().optional(),
    departmentId: z.string().trim().min(1).max(120).nullable().optional(),
    position: z.string().trim().max(120).nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    hireDate: dateRule.nullable().optional(),
    status: employeeStatusRule.optional(),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const createTimeOffSchema = z
  .object({
    employeeId: z.string().trim().min(1).max(120),
    type: timeOffTypeRule,
    startDate: dateRule,
    endDate: dateRule,
    reason: z.string().trim().max(1000).optional(),
  })
  .strict();

export const decideTimeOffSchema = z
  .object({
    to: z.enum(['APPROVED', 'REJECTED']),
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const cancelTimeOffSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const departmentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
});

export const employeeQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  departmentId: z.string().trim().min(1).max(120).optional(),
  status: employeeStatusRule.optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const timeOffQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  employeeId: z.string().trim().min(1).max(120).optional(),
  status: timeOffStatusRule.optional(),
  type: timeOffTypeRule.optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const hrIdParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

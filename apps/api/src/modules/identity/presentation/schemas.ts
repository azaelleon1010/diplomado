/**
 * Identity request DTOs — Zod strict schemas.
 * Unknown dangerous fields are rejected.
 */
import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().min(1).max(254).email(),
    password: z.string().min(1).max(256),
    tenantId: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).max(4096),
  })
  .strict();

export type RefreshDto = z.infer<typeof refreshSchema>;

export const createUserSchema = z
  .object({
    email: z.string().trim().min(1).max(254).email(),
    username: z.string().trim().min(3).max(64),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    roleIds: z.array(z.string().min(1)).max(50).optional(),
    organizationId: z.string().trim().max(120).optional(),
    branchId: z.string().trim().max(120).optional(),
  })
  .strict();

export type CreateUserDto = z.infer<typeof createUserSchema>;

export const assignRoleSchema = z
  .object({
    roleIds: z.array(z.string().min(1)).min(1).max(50),
  })
  .strict();

export type AssignRoleDto = z.infer<typeof assignRoleSchema>;

const usernameRule = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Username may only contain letters, numbers, dots, underscores and dashes');

export const registerSchema = z
  .object({
    companyName: z.string().trim().min(2).max(200),
    username: usernameRule,
    email: z.string().trim().min(1).max(254).email(),
    password: z.string().min(8).max(128),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
  })
  .strict();

export type RegisterDto = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z
  .object({
    email: z.string().trim().min(1).max(254).email(),
    tenantId: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    resetId: z.string().trim().min(1).max(120),
    token: z.string().trim().min(32).max(256),
    newPassword: z.string().min(8).max(128),
  })
  .strict();

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const usersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

export const setUserStatusSchema = z
  .object({
    status: z.enum(['ACTIVE', 'DISABLED']),
  })
  .strict();

export type SetUserStatusDto = z.infer<typeof setUserStatusSchema>;

const permissionRule = z.string().trim().min(1).max(60);

export const createRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(64),
    description: z.string().trim().max(280).optional(),
    permissions: z.array(permissionRule).max(200).default([]),
  })
  .strict();

export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(64).optional(),
    description: z.string().trim().max(280).optional(),
    permissions: z.array(permissionRule).max(200).optional(),
    status: z.enum(['ACTIVE', 'DISABLED']).optional(),
    // NOTE: versions are 0-based at runtime (Mongoose optimisticConcurrency
    // manages versionKey starting at 0), so 0 must be accepted here.
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

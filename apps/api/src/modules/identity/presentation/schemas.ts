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

export const usersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().trim().min(1).max(120),
});

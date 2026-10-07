/**
 * Identity controllers — thin HTTP adapters over use cases.
 * Business rules live in Application; errors flow to the global errorHandler.
 */
import type { NextFunction, Request, Response } from 'express';
import type { ActorContext, IdentityDeps } from '../application/usecases';
import {
  assignRole,
  createUser,
  getMe,
  getUserById,
  listUsersWithRoles,
  login,
  logout,
  refresh,
  register,
  setUserStatus,
} from '../application/usecases';
import { requestPasswordReset, resetPassword, type PasswordResetDeps } from '../application/passwordReset';
import { createRole, getRole, listRoles, updateRole, type RoleDeps } from '../application/roles';
import {
  assignRoleSchema,
  createRoleSchema,
  createUserSchema,
  forgotPasswordSchema,
  idParamSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  setUserStatusSchema,
  updateRoleSchema,
  usersQuerySchema,
} from './schemas';

function actorOf(req: Request): ActorContext {
  return {
    // authenticate + requireTenant guarantee these.
    userId: req.userId as string,
    tenantId: req.tenantId as string,
    sessionId: req.sessionId,
    correlationId: req.traceId,
  };
}

function ok(res: Response, req: Request, data: unknown, status = 200, meta?: Record<string, unknown>) {
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}), traceId: req.traceId });
}

export function createAuthController(deps: PasswordResetDeps) {
  return {
    async getTenantBySlug(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const slug = String(req.params.slug ?? '').trim().toLowerCase();

        if (!slug) {
          throw new Error('Tenant slug is required');
        }

        const tenant = await deps.tenants.findBySlug(slug);

        if (!tenant || tenant.status !== 'ACTIVE') {
          res.status(404).json({
            success: false,
            error: {
              code: 'TENANT_NOT_FOUND',
              message: 'Empresa no encontrada',
              fields: {},
            },
            traceId: req.traceId,
          });
          return;
        }

        ok(res, req, {
          tenantId: tenant.tenantId,
          name: tenant.name,
          slug: tenant.slug,
        });
      } catch (err) {
        next(err);
      }
    },

    async postRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = registerSchema.parse(req.body);
        const result = await register({ ...dto, correlationId: req.traceId }, deps);
        ok(res, req, result, 201);
      } catch (err) {
        next(err);
      }
    },

    async postLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = loginSchema.parse(req.body);
        const result = await login({ ...dto, correlationId: req.traceId }, deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },

    async postRefresh(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = refreshSchema.parse(req.body);
        const result = await refresh({ ...dto, correlationId: req.traceId }, deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },

    async postForgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = forgotPasswordSchema.parse(req.body);
        const result = await requestPasswordReset({ ...dto, correlationId: req.traceId }, deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },

    async postResetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = resetPasswordSchema.parse(req.body);
        const result = await resetPassword({ ...dto, correlationId: req.traceId }, deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },

    async postLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        await logout(actorOf(req), deps);
        ok(res, req, { loggedOut: true });
      } catch (err) {
        next(err);
      }
    },

    async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const result = await getMe(actorOf(req), deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },
  };
}

export function createUsersController(deps: IdentityDeps) {
  return {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = usersQuerySchema.parse(req.query);
        const result = await listUsersWithRoles(actorOf(req), query.page, query.limit, deps);
        ok(res, req, result.data, 200, {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        });
      } catch (err) {
        next(err);
      }
    },

    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const result = await getUserById(actorOf(req), params.id, deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },

    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createUserSchema.parse(req.body);
        const result = await createUser(actorOf(req), dto, deps);
        ok(res, req, result, 201);
      } catch (err) {
        next(err);
      }
    },

    async assignRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const dto = assignRoleSchema.parse(req.body);
        const ctx = actorOf(req);
        const result = await assignRole({ ...ctx }, { userId: params.id, roleIds: dto.roleIds }, deps);
        ok(res, req, {
          _id: result._id,
          tenantId: result.tenantId,
          userId: result.userId,
          roleIds: result.roleIds,
          status: result.status,
        });
      } catch (err) {
        next(err);
      }
    },

    async setStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const dto = setUserStatusSchema.parse(req.body);
        const result = await setUserStatus(actorOf(req), params.id, dto.status, deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },
  };
}

export function createRolesController(deps: RoleDeps) {
  return {
    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const result = await listRoles(actorOf(req), deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },

    async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const result = await getRole(actorOf(req), params.id, deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },

    async create(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createRoleSchema.parse(req.body);
        const result = await createRole(actorOf(req), dto, deps);
        ok(res, req, result, 201);
      } catch (err) {
        next(err);
      }
    },

    async update(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const dto = updateRoleSchema.parse(req.body);
        const result = await updateRole(actorOf(req), params.id, dto, deps);
        ok(res, req, result);
      } catch (err) {
        next(err);
      }
    },
  };
}

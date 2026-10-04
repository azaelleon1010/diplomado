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
  listUsers,
  login,
  logout,
  refresh,
} from '../application/usecases';
import { assignRoleSchema, createUserSchema, idParamSchema, loginSchema, refreshSchema, usersQuerySchema } from './schemas';

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

export function createAuthController(deps: IdentityDeps) {
  return {
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
        const result = await listUsers(actorOf(req), query.page, query.limit, deps);
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
  };
}

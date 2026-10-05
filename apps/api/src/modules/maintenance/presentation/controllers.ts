/**
 * Maintenance controllers — thin HTTP adapters over use cases.
 * Business rules live in Application; errors flow to the global errorHandler.
 */
import type { NextFunction, Request, Response } from 'express';
import type { MaintenanceActor, MaintenanceDeps } from '../application/usecases';
import {
  cancelOrder,
  createAsset,
  createOrder,
  getAsset,
  getOrder,
  listAssets,
  listOrders,
  retireAsset,
  transitionOrder,
  updateAsset,
  updateOrder,
} from '../application/usecases';
import {
  assetQuerySchema,
  createAssetSchema,
  createOrderSchema,
  idParamSchema,
  orderQuerySchema,
  transitionOrderSchema,
  updateAssetSchema,
  updateOrderSchema,
} from './schemas';

function actorOf(req: Request): MaintenanceActor {
  return {
    // authenticate + requireTenant guarantee these.
    userId: req.userId as string,
    tenantId: req.tenantId as string,
    correlationId: req.traceId,
  };
}

function ok(res: Response, req: Request, data: unknown, status = 200, meta?: Record<string, unknown>) {
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}), traceId: req.traceId });
}

function pagedMeta(result: { page: number; limit: number; total: number; totalPages: number }) {
  return { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages };
}

export function createMaintenanceController(deps: MaintenanceDeps) {
  return {
    // -- Assets -----------------------------------------------------------
    async listAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = assetQuerySchema.parse(req.query);
        const result = await listAssets(
          actorOf(req),
          { search: query.search, status: query.status, type: query.type },
          query.page,
          query.limit,
          query.sortBy ?? 'createdAt',
          query.sortOrder,
          deps,
        );
        ok(res, req, result.data, 200, pagedMeta(result));
      } catch (err) {
        next(err);
      }
    },

    async getAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await getAsset(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createAssetSchema.parse(req.body);
        ok(res, req, await createAsset(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const dto = updateAssetSchema.parse(req.body);
        ok(res, req, await updateAsset(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await retireAsset(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    // -- Orders -----------------------------------------------------------
    async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = orderQuerySchema.parse(req.query);
        const result = await listOrders(
          actorOf(req),
          { assetId: query.assetId, status: query.status, priority: query.priority, type: query.type },
          query.page,
          query.limit,
          query.sortBy ?? 'createdAt',
          query.sortOrder,
          deps,
        );
        ok(res, req, result.data, 200, pagedMeta(result));
      } catch (err) {
        next(err);
      }
    },

    async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await getOrder(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createOrderSchema.parse(req.body);
        ok(res, req, await createOrder(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const dto = updateOrderSchema.parse(req.body);
        ok(res, req, await updateOrder(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async transitionOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const dto = transitionOrderSchema.parse(req.body);
        const ctx = actorOf(req);
        ok(res, req, await transitionOrder(ctx, params.id, dto.to, dto.expectedVersion, dto.completedCost, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await cancelOrder(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },
  };
}

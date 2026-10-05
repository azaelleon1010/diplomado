/**
 * Production controllers — thin HTTP adapters over use cases.
 * Business rules live in Application; errors flow to the global errorHandler.
 */
import type { NextFunction, Request, Response } from 'express';
import type { ProductionActor, ProductionDeps } from '../application/usecases';
import {
  cancelProductionOrder,
  createProductionOrder,
  getProductionOrder,
  listProductionOrders,
  transitionProductionOrder,
  updateProductionOrder,
} from '../application/usecases';
import {
  createProductionOrderSchema,
  productionIdParamSchema,
  productionOrderQuerySchema,
  transitionProductionOrderSchema,
  updateProductionOrderSchema,
} from './schemas';

function actorOf(req: Request): ProductionActor {
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

export function createProductionController(deps: ProductionDeps) {
  return {
    async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = productionOrderQuerySchema.parse(req.query);
        const result = await listProductionOrders(
          actorOf(req),
          { productId: query.productId, status: query.status },
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
        const params = productionIdParamSchema.parse(req.params);
        ok(res, req, await getProductionOrder(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createProductionOrderSchema.parse(req.body);
        ok(res, req, await createProductionOrder(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = productionIdParamSchema.parse(req.params);
        const dto = updateProductionOrderSchema.parse(req.body);
        ok(res, req, await updateProductionOrder(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async transitionOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = productionIdParamSchema.parse(req.params);
        const dto = transitionProductionOrderSchema.parse(req.body);
        const ctx = actorOf(req);
        ok(
          res,
          req,
          await transitionProductionOrder(ctx, params.id, dto.to, dto.expectedVersion, { producedQuantity: dto.producedQuantity, materials: dto.materials }, deps),
        );
      } catch (err) {
        next(err);
      }
    },

    async deleteOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = productionIdParamSchema.parse(req.params);
        ok(res, req, await cancelProductionOrder(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },
  };
}

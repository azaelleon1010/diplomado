/**
 * Inventory ledger controllers — thin HTTP adapters.
 * tenantId/userId/permissions always come from the authenticated request.
 */
import type { NextFunction, Request, Response } from 'express';
import {
  listStockBalances,
  listStockMovements,
  postManualMovements,
  transferStock,
  type StockActor,
  type StockDeps,
} from '../application/stock';
import type { StockSourceType } from '../domain/stock';
import { movementQuerySchema, postMovementsSchema, stockQuerySchema, transferSchema } from './schemas';

function actorOf(req: Request): StockActor {
  return {
    userId: req.userId as string,
    tenantId: req.tenantId as string,
    correlationId: req.traceId,
    permissions: req.grantedPermissions ?? [],
  };
}

function send(res: Response, req: Request, data: unknown, status = 200, meta?: Record<string, unknown>) {
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}), traceId: req.traceId });
}

export function createStockController(deps: StockDeps) {
  return {
    async listStock(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const q = stockQuerySchema.parse(req.query);
        const result = await listStockBalances(actorOf(req), { productId: q.productId, warehouseId: q.warehouseId, nonZero: q.nonZero }, q.page, q.limit, deps);
        send(res, req, result.data, 200, { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages });
      } catch (err) {
        next(err);
      }
    },

    async listMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const q = movementQuerySchema.parse(req.query);
        const result = await listStockMovements(
          actorOf(req),
          {
            productId: q.productId,
            warehouseId: q.warehouseId,
            type: q.type,
            sourceType: q.sourceType as StockSourceType | undefined,
            sourceId: q.sourceId,
            postingId: q.postingId,
          },
          q.page,
          q.limit,
          deps,
        );
        send(res, req, result.data, 200, { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages });
      } catch (err) {
        next(err);
      }
    },

    async postMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = postMovementsSchema.parse(req.body);
        const result = await postManualMovements(actorOf(req), dto, deps);
        send(res, req, result, result.replayed ? 200 : 201);
      } catch (err) {
        next(err);
      }
    },

    async postTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = transferSchema.parse(req.body);
        const result = await transferStock(actorOf(req), dto, deps);
        send(res, req, result, result.replayed ? 200 : 201);
      } catch (err) {
        next(err);
      }
    },
  };
}

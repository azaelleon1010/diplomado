/**
 * Purchasing controllers — thin HTTP adapters over use cases.
 * Business rules live in Application; errors flow to the global errorHandler.
 */
import type { NextFunction, Request, Response } from 'express';
import type { PurchasingActor, PurchasingDeps } from '../application/usecases';
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  deactivateSupplier,
  getPurchaseOrder,
  getSupplier,
  listPurchaseOrders,
  listSuppliers,
  transitionPurchaseOrder,
  updatePurchaseOrder,
  updateSupplier,
} from '../application/usecases';
import { getGoodsReceipt, listGoodsReceipts, receivePurchaseOrder, type ReceiptDeps } from '../application/receipts';
import {
  createPurchaseOrderSchema,
  createSupplierSchema,
  purchaseOrderQuerySchema,
  purchasingIdParamSchema,
  receiptQuerySchema,
  receiveOrderSchema,
  supplierQuerySchema,
  transitionPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  updateSupplierSchema,
} from './schemas';

function actorOf(req: Request): PurchasingActor {
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

export function createPurchasingController(deps: PurchasingDeps) {
  return {
    // -- Suppliers --------------------------------------------------------
    async listSuppliers(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = supplierQuerySchema.parse(req.query);
        const result = await listSuppliers(
          actorOf(req),
          { search: query.search, status: query.status },
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

    async getSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = purchasingIdParamSchema.parse(req.params);
        ok(res, req, await getSupplier(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createSupplierSchema.parse(req.body);
        ok(res, req, await createSupplier(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = purchasingIdParamSchema.parse(req.params);
        const dto = updateSupplierSchema.parse(req.body);
        ok(res, req, await updateSupplier(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteSupplier(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = purchasingIdParamSchema.parse(req.params);
        ok(res, req, await deactivateSupplier(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    // -- Purchase orders --------------------------------------------------
    async listOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = purchaseOrderQuerySchema.parse(req.query);
        const result = await listPurchaseOrders(
          actorOf(req),
          { supplierId: query.supplierId, status: query.status },
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
        const params = purchasingIdParamSchema.parse(req.params);
        ok(res, req, await getPurchaseOrder(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createPurchaseOrderSchema.parse(req.body);
        ok(res, req, await createPurchaseOrder(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = purchasingIdParamSchema.parse(req.params);
        const dto = updatePurchaseOrderSchema.parse(req.body);
        ok(res, req, await updatePurchaseOrder(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async transitionOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = purchasingIdParamSchema.parse(req.params);
        const dto = transitionPurchaseOrderSchema.parse(req.body);
        const ctx = actorOf(req);
        ok(
          res,
          req,
          await transitionPurchaseOrder(ctx, params.id, dto.to, dto.expectedVersion, deps),
        );
      } catch (err) {
        next(err);
      }
    },

    async deleteOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = purchasingIdParamSchema.parse(req.params);
        ok(res, req, await cancelPurchaseOrder(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },
  };
}

export function createReceiptController(deps: ReceiptDeps) {
  return {
    async receive(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = purchasingIdParamSchema.parse(req.params);
        const dto = receiveOrderSchema.parse(req.body);
        const result = await receivePurchaseOrder(actorOf(req), params.id, dto, deps);
        ok(res, req, result, result.replayed ? 200 : 201);
      } catch (err) {
        next(err);
      }
    },

    async list(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const q = receiptQuerySchema.parse(req.query);
        const result = await listGoodsReceipts(actorOf(req), { purchaseOrderId: q.purchaseOrderId, supplierId: q.supplierId, warehouseId: q.warehouseId }, q.page, q.limit, deps);
        ok(res, req, result.data, 200, pagedMeta(result));
      } catch (err) {
        next(err);
      }
    },

    async get(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = purchasingIdParamSchema.parse(req.params);
        ok(res, req, await getGoodsReceipt(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },
  };
}

/**
 * Purchase request controllers — thin HTTP adapters.
 */
import type { NextFunction, Request, Response } from 'express';
import type { PurchasingActor } from '../application/usecases';
import {
  cancelPurchaseRequest,
  convertRequestToOrder,
  createPurchaseRequest,
  decidePurchaseRequest,
  getPurchaseRequest,
  listPurchaseRequests,
  submitPurchaseRequest,
  updatePurchaseRequest,
  type RequestDeps,
} from '../application/requests';
import {
  convertRequestSchema,
  createRequestSchema,
  decideRequestSchema,
  purchasingIdParamSchema,
  requestQuerySchema,
  updateRequestSchema,
  versionSchema,
} from './schemas';

function actorOf(req: Request): PurchasingActor {
  return { userId: req.userId as string, tenantId: req.tenantId as string, correlationId: req.traceId };
}

function ok(res: Response, req: Request, data: unknown, status = 200, meta?: Record<string, unknown>) {
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}), traceId: req.traceId });
}

type Handler = (req: Request, res: Response) => Promise<void>;
const wrap = (fn: Handler) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

export function createRequestController(deps: RequestDeps) {
  return {
    list: wrap(async (req, res) => {
      const q = requestQuerySchema.parse(req.query);
      const ctx = actorOf(req);
      const result = await listPurchaseRequests(ctx, { status: q.status, ...(q.mine ? { requestedBy: ctx.userId } : {}) }, q.page, q.limit, deps);
      ok(res, req, result.data, 200, { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages });
    }),
    get: wrap(async (req, res) => {
      const { id } = purchasingIdParamSchema.parse(req.params);
      ok(res, req, await getPurchaseRequest(actorOf(req), id, deps));
    }),
    create: wrap(async (req, res) => {
      ok(res, req, await createPurchaseRequest(actorOf(req), createRequestSchema.parse(req.body), deps), 201);
    }),
    update: wrap(async (req, res) => {
      const { id } = purchasingIdParamSchema.parse(req.params);
      ok(res, req, await updatePurchaseRequest(actorOf(req), id, updateRequestSchema.parse(req.body), deps));
    }),
    submit: wrap(async (req, res) => {
      const { id } = purchasingIdParamSchema.parse(req.params);
      ok(res, req, await submitPurchaseRequest(actorOf(req), id, versionSchema.parse(req.body).expectedVersion, deps));
    }),
    decide: wrap(async (req, res) => {
      const { id } = purchasingIdParamSchema.parse(req.params);
      const dto = decideRequestSchema.parse(req.body);
      ok(res, req, await decidePurchaseRequest(actorOf(req), id, dto.decision, dto.expectedVersion, dto.reason, deps));
    }),
    cancel: wrap(async (req, res) => {
      const { id } = purchasingIdParamSchema.parse(req.params);
      ok(res, req, await cancelPurchaseRequest(actorOf(req), id, deps));
    }),
    convert: wrap(async (req, res) => {
      const { id } = purchasingIdParamSchema.parse(req.params);
      ok(res, req, await convertRequestToOrder(actorOf(req), id, convertRequestSchema.parse(req.body), deps), 201);
    }),
  };
}

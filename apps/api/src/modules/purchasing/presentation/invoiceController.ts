/**
 * Supplier invoice / accounts payable controllers — thin HTTP adapters.
 */
import type { NextFunction, Request, Response } from 'express';
import {
  cancelSupplierInvoice,
  getSupplierInvoice,
  listSupplierInvoices,
  payablesSummary,
  registerSupplierInvoice,
  releaseSupplierInvoice,
  type InvoiceActor,
  type InvoiceDeps,
} from '../application/invoices';
import {
  cancelInvoiceSchema,
  invoiceQuerySchema,
  payablesQuerySchema,
  purchasingIdParamSchema,
  registerInvoiceSchema,
  versionSchema,
} from './schemas';

function actorOf(req: Request): InvoiceActor {
  return { userId: req.userId as string, tenantId: req.tenantId as string, correlationId: req.traceId };
}

function ok(res: Response, req: Request, data: unknown, status = 200, meta?: Record<string, unknown>) {
  res.status(status).json({ success: true, data, ...(meta ? { meta } : {}), traceId: req.traceId });
}

const wrap = (fn: (req: Request, res: Response) => Promise<void>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

export function createInvoiceController(deps: InvoiceDeps) {
  return {
    list: wrap(async (req, res) => {
      const q = invoiceQuerySchema.parse(req.query);
      const result = await listSupplierInvoices(actorOf(req), { supplierId: q.supplierId, purchaseOrderId: q.purchaseOrderId, status: q.status, open: q.open }, q.page, q.limit, deps);
      ok(res, req, result.data, 200, { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages });
    }),
    get: wrap(async (req, res) => {
      const { id } = purchasingIdParamSchema.parse(req.params);
      ok(res, req, await getSupplierInvoice(actorOf(req), id, deps));
    }),
    register: wrap(async (req, res) => {
      const result = await registerSupplierInvoice(actorOf(req), registerInvoiceSchema.parse(req.body), deps);
      ok(res, req, result, result.replayed ? 200 : 201);
    }),
    release: wrap(async (req, res) => {
      const { id } = purchasingIdParamSchema.parse(req.params);
      ok(res, req, await releaseSupplierInvoice(actorOf(req), id, versionSchema.parse(req.body).expectedVersion, deps));
    }),
    cancel: wrap(async (req, res) => {
      const { id } = purchasingIdParamSchema.parse(req.params);
      const dto = cancelInvoiceSchema.parse(req.body);
      ok(res, req, await cancelSupplierInvoice(actorOf(req), id, dto.expectedVersion, dto.reason, deps));
    }),
    payables: wrap(async (req, res) => {
      const q = payablesQuerySchema.parse(req.query);
      ok(res, req, await payablesSummary(actorOf(req), q.supplierId, deps));
    }),
  };
}

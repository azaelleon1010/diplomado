/**
 * Purchasing routes + composition root.
 * Routers are built from explicit dependencies (no service locator).
 * Auth primitives (authenticate/requireTenant/requirePermission) are reused
 * from the identity module. Products always come from the inventory catalog.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import type { PurchasingDeps } from '../application/usecases';
import type { ReceiptDeps } from '../application/receipts';
import type { RequestDeps } from '../application/requests';
import { MongoPurchaseRequestStore } from '../infrastructure/requestRepository';
import { createRequestController } from './requestController';
import type { InventoryDeps } from '../../inventory/application/usecases';
import { buildInventoryDeps, buildStockDeps } from '../../inventory/presentation/routes';
import { MongoGoodsReceiptStore } from '../infrastructure/receiptRepository';
import { MongoIdempotencyStore } from '../../../shared/idempotency';
import { MongoSequenceStore } from '../../../shared/sequence';
import { PERMISSIONS } from '../../identity/domain/permissions';
import { MongoAuditSink } from '../../identity/infrastructure/repositories';
import { MongoProductStore } from '../../inventory/infrastructure/repositories';
import { MongoPurchaseOrderStore, MongoSupplierStore } from '../infrastructure/repositories';
import { createPurchasingController, createReceiptController } from './controllers';
import {
  authenticate,
  requirePermission,
  requireTenant,
  type AuthMiddlewareDeps,
} from '../../identity/presentation/middleware';

export function buildPurchasingDeps(): PurchasingDeps {
  return {
    suppliers: new MongoSupplierStore(),
    orders: new MongoPurchaseOrderStore(),
    products: new MongoProductStore(),
    audit: new MongoAuditSink(),
  };
}

export function buildReceiptDeps(purchasing: PurchasingDeps, inventory: InventoryDeps = buildInventoryDeps()): ReceiptDeps {
  return {
    orders: purchasing.orders,
    receipts: new MongoGoodsReceiptStore(),
    products: purchasing.products,
    stock: buildStockDeps(inventory),
    sequences: new MongoSequenceStore(),
    idempotency: new MongoIdempotencyStore(),
    audit: purchasing.audit,
  };
}

export function buildRequestDeps(purchasing: PurchasingDeps): RequestDeps {
  return { ...purchasing, requests: new MongoPurchaseRequestStore(), sequences: new MongoSequenceStore() };
}

/** Permission required for each manual status change (body.to). */
const TRANSITION_PERMISSION: Record<string, string> = {
  SENT: PERMISSIONS.PURCHASING_UPDATE,
  APPROVED: PERMISSIONS.PURCHASING_APPROVE,
  CANCELLED: PERMISSIONS.PURCHASING_CANCEL,
};

/** Mounted at /api/v1/purchasing. */
export function createPurchasingRouter(
  deps: PurchasingDeps,
  auth: AuthMiddlewareDeps,
  receiptDeps: ReceiptDeps = buildReceiptDeps(deps),
  requestDeps: RequestDeps = buildRequestDeps(deps),
) {
  const router = Router();
  const controller = createPurchasingController(deps);
  const receipts = createReceiptController(receiptDeps);
  const requests = createRequestController(requestDeps);
  const guard = [authenticate(auth), requireTenant()];
  const read = requirePermission(auth, PERMISSIONS.PURCHASING_READ);
  const create = requirePermission(auth, PERMISSIONS.PURCHASING_CREATE);
  const update = requirePermission(auth, PERMISSIONS.PURCHASING_UPDATE);
  const remove = requirePermission(auth, PERMISSIONS.PURCHASING_DELETE);
  const cancel = requirePermission(auth, PERMISSIONS.PURCHASING_CANCEL);
  const receive = requirePermission(auth, PERMISSIONS.PURCHASING_RECEIVE);
  // Unknown/receipt targets fall back to update; the use case rejects them.
  const transitionPermission = (req: Request, res: Response, next: NextFunction) => {
    const to = typeof req.body?.to === 'string' ? req.body.to : '';
    return requirePermission(auth, TRANSITION_PERMISSION[to] ?? PERMISSIONS.PURCHASING_UPDATE)(req, res, next);
  };

  router.get('/suppliers', ...guard, read, controller.listSuppliers);
  router.post('/suppliers', ...guard, create, controller.createSupplier);
  router.get('/suppliers/:id', ...guard, read, controller.getSupplier);
  router.patch('/suppliers/:id', ...guard, update, controller.updateSupplier);
  router.delete('/suppliers/:id', ...guard, remove, controller.deleteSupplier);

  router.get('/orders', ...guard, read, controller.listOrders);
  router.post('/orders', ...guard, create, controller.createOrder);
  router.get('/orders/:id', ...guard, read, controller.getOrder);
  router.patch('/orders/:id', ...guard, update, controller.updateOrder);
  router.post('/orders/:id/transition', ...guard, transitionPermission, controller.transitionOrder);
  router.delete('/orders/:id', ...guard, cancel, controller.deleteOrder);

  // Goods receipts: reception posts to the inventory ledger.
  router.post('/orders/:id/receipts', ...guard, receive, receipts.receive);
  router.get('/receipts', ...guard, read, receipts.list);
  router.get('/receipts/:id', ...guard, read, receipts.get);

  // Purchase requests: need → approval → purchase order.
  const approve = requirePermission(auth, PERMISSIONS.PURCHASING_APPROVE);
  router.get('/requests', ...guard, read, requests.list);
  router.post('/requests', ...guard, create, requests.create);
  router.get('/requests/:id', ...guard, read, requests.get);
  router.patch('/requests/:id', ...guard, create, requests.update);
  router.post('/requests/:id/submit', ...guard, create, requests.submit);
  router.post('/requests/:id/decision', ...guard, approve, requests.decide);
  router.post('/requests/:id/cancel', ...guard, cancel, requests.cancel);
  router.post('/requests/:id/convert', ...guard, create, requests.convert);

  return router;
}

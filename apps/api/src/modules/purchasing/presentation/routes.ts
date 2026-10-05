/**
 * Purchasing routes + composition root.
 * Routers are built from explicit dependencies (no service locator).
 * Auth primitives (authenticate/requireTenant/requirePermission) are reused
 * from the identity module. Products always come from the inventory catalog.
 */
import { Router } from 'express';
import type { PurchasingDeps } from '../application/usecases';
import { PERMISSIONS } from '../../identity/domain/permissions';
import { MongoAuditSink } from '../../identity/infrastructure/repositories';
import { MongoProductStore } from '../../inventory/infrastructure/repositories';
import { MongoPurchaseOrderStore, MongoSupplierStore } from '../infrastructure/repositories';
import { createPurchasingController } from './controllers';
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

/** Mounted at /api/v1/purchasing. */
export function createPurchasingRouter(deps: PurchasingDeps, auth: AuthMiddlewareDeps) {
  const router = Router();
  const controller = createPurchasingController(deps);
  const guard = [authenticate(auth), requireTenant()];
  const read = requirePermission(auth, PERMISSIONS.PURCHASING_READ);
  const create = requirePermission(auth, PERMISSIONS.PURCHASING_CREATE);
  const update = requirePermission(auth, PERMISSIONS.PURCHASING_UPDATE);
  const remove = requirePermission(auth, PERMISSIONS.PURCHASING_DELETE);

  router.get('/suppliers', ...guard, read, controller.listSuppliers);
  router.post('/suppliers', ...guard, create, controller.createSupplier);
  router.get('/suppliers/:id', ...guard, read, controller.getSupplier);
  router.patch('/suppliers/:id', ...guard, update, controller.updateSupplier);
  router.delete('/suppliers/:id', ...guard, remove, controller.deleteSupplier);

  router.get('/orders', ...guard, read, controller.listOrders);
  router.post('/orders', ...guard, create, controller.createOrder);
  router.get('/orders/:id', ...guard, read, controller.getOrder);
  router.patch('/orders/:id', ...guard, update, controller.updateOrder);
  router.post('/orders/:id/transition', ...guard, update, controller.transitionOrder);
  router.delete('/orders/:id', ...guard, remove, controller.deleteOrder);

  return router;
}

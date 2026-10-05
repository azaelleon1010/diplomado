/**
 * Production routes + composition root.
 * Routers are built from explicit dependencies (no service locator).
 * Auth primitives (authenticate/requireTenant/requirePermission) are reused
 * from the identity module. Products always come from the inventory catalog.
 */
import { Router } from 'express';
import type { ProductionDeps } from '../application/usecases';
import { PERMISSIONS } from '../../identity/domain/permissions';
import { MongoAuditSink } from '../../identity/infrastructure/repositories';
import { MongoProductStore } from '../../inventory/infrastructure/repositories';
import { MongoProductionOrderStore } from '../infrastructure/repositories';
import { createProductionController } from './controllers';
import {
  authenticate,
  requirePermission,
  requireTenant,
  type AuthMiddlewareDeps,
} from '../../identity/presentation/middleware';

export function buildProductionDeps(): ProductionDeps {
  return {
    orders: new MongoProductionOrderStore(),
    products: new MongoProductStore(),
    audit: new MongoAuditSink(),
  };
}

/** Mounted at /api/v1/production. */
export function createProductionRouter(deps: ProductionDeps, auth: AuthMiddlewareDeps) {
  const router = Router();
  const controller = createProductionController(deps);
  const guard = [authenticate(auth), requireTenant()];
  const read = requirePermission(auth, PERMISSIONS.PRODUCTION_READ);
  const create = requirePermission(auth, PERMISSIONS.PRODUCTION_CREATE);
  const update = requirePermission(auth, PERMISSIONS.PRODUCTION_UPDATE);
  const remove = requirePermission(auth, PERMISSIONS.PRODUCTION_DELETE);

  router.get('/orders', ...guard, read, controller.listOrders);
  router.post('/orders', ...guard, create, controller.createOrder);
  router.get('/orders/:id', ...guard, read, controller.getOrder);
  router.patch('/orders/:id', ...guard, update, controller.updateOrder);
  router.post('/orders/:id/transition', ...guard, update, controller.transitionOrder);
  router.delete('/orders/:id', ...guard, remove, controller.deleteOrder);

  return router;
}

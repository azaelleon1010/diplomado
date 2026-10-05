/**
 * Maintenance routes + composition root.
 * Routers are built from explicit dependencies (no service locator).
 * Auth primitives (authenticate/requireTenant/requirePermission) are reused
 * from the identity module.
 */
import { Router } from 'express';
import type { MaintenanceDeps } from '../application/usecases';
import { PERMISSIONS } from '../../identity/domain/permissions';
import { MongoAuditSink } from '../../identity/infrastructure/repositories';
import { MongoAssetStore, MongoMaintenanceOrderStore } from '../infrastructure/repositories';
import { createMaintenanceController } from './controllers';
import {
  authenticate,
  requirePermission,
  requireTenant,
  type AuthMiddlewareDeps,
} from '../../identity/presentation/middleware';

export function buildMaintenanceDeps(): MaintenanceDeps {
  return {
    assets: new MongoAssetStore(),
    orders: new MongoMaintenanceOrderStore(),
    audit: new MongoAuditSink(),
  };
}

/** Mounted at /api/v1/maintenance. */
export function createMaintenanceRouter(deps: MaintenanceDeps, auth: AuthMiddlewareDeps) {
  const router = Router();
  const controller = createMaintenanceController(deps);
  const guard = [authenticate(auth), requireTenant()];
  const read = requirePermission(auth, PERMISSIONS.MAINTENANCE_READ);
  const create = requirePermission(auth, PERMISSIONS.MAINTENANCE_CREATE);
  const update = requirePermission(auth, PERMISSIONS.MAINTENANCE_UPDATE);
  const remove = requirePermission(auth, PERMISSIONS.MAINTENANCE_DELETE);

  router.get('/assets', ...guard, read, controller.listAssets);
  router.post('/assets', ...guard, create, controller.createAsset);
  router.get('/assets/:id', ...guard, read, controller.getAsset);
  router.patch('/assets/:id', ...guard, update, controller.updateAsset);
  router.delete('/assets/:id', ...guard, remove, controller.deleteAsset);

  router.get('/orders', ...guard, read, controller.listOrders);
  router.post('/orders', ...guard, create, controller.createOrder);
  router.get('/orders/:id', ...guard, read, controller.getOrder);
  router.patch('/orders/:id', ...guard, update, controller.updateOrder);
  router.post('/orders/:id/transition', ...guard, update, controller.transitionOrder);
  router.delete('/orders/:id', ...guard, remove, controller.deleteOrder);

  return router;
}

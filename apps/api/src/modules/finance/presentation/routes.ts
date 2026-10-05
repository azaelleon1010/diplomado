/**
 * Finance routes + composition root.
 * Routers are built from explicit dependencies (no service locator).
 * Auth primitives (authenticate/requireTenant/requirePermission) are reused
 * from the identity module.
 */
import { Router } from 'express';
import type { FinanceDeps } from '../application/usecases';
import { PERMISSIONS } from '../../identity/domain/permissions';
import { MongoAuditSink } from '../../identity/infrastructure/repositories';
import { MongoAccountStore, MongoFinanceCategoryStore, MongoMovementStore } from '../infrastructure/repositories';
import { createFinanceController } from './controllers';
import {
  authenticate,
  requirePermission,
  requireTenant,
  type AuthMiddlewareDeps,
} from '../../identity/presentation/middleware';

export function buildFinanceDeps(): FinanceDeps {
  return {
    accounts: new MongoAccountStore(),
    categories: new MongoFinanceCategoryStore(),
    movements: new MongoMovementStore(),
    audit: new MongoAuditSink(),
  };
}

/** Mounted at /api/v1/finance. */
export function createFinanceRouter(deps: FinanceDeps, auth: AuthMiddlewareDeps) {
  const router = Router();
  const controller = createFinanceController(deps);
  const guard = [authenticate(auth), requireTenant()];
  const read = requirePermission(auth, PERMISSIONS.FINANCE_READ);
  const create = requirePermission(auth, PERMISSIONS.FINANCE_CREATE);
  const update = requirePermission(auth, PERMISSIONS.FINANCE_UPDATE);
  const remove = requirePermission(auth, PERMISSIONS.FINANCE_DELETE);

  router.get('/accounts', ...guard, read, controller.listAccounts);
  router.post('/accounts', ...guard, create, controller.createAccount);
  router.get('/accounts/:id', ...guard, read, controller.getAccount);
  router.patch('/accounts/:id', ...guard, update, controller.updateAccount);
  router.delete('/accounts/:id', ...guard, remove, controller.deleteAccount);

  router.get('/categories', ...guard, read, controller.listCategories);
  router.post('/categories', ...guard, create, controller.createCategory);
  router.get('/categories/:id', ...guard, read, controller.getCategory);
  router.patch('/categories/:id', ...guard, update, controller.updateCategory);
  router.delete('/categories/:id', ...guard, remove, controller.deleteCategory);

  router.get('/movements/totals', ...guard, read, controller.movementTotals);
  router.get('/movements', ...guard, read, controller.listMovements);
  router.post('/movements', ...guard, create, controller.createMovement);
  router.get('/movements/:id', ...guard, read, controller.getMovement);
  router.post('/movements/:id/void', ...guard, update, controller.voidMovement);

  return router;
}

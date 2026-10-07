/**
 * Inventory routes + composition root.
 * Routers are built from explicit dependencies (no service locator).
 * Auth primitives (authenticate/requireTenant/requirePermission) are reused
 * from the identity module.
 */
import { Router } from 'express';
import type { InventoryDeps } from '../application/usecases';
import { PERMISSIONS } from '../../identity/domain/permissions';
import { MongoAuditSink } from '../../identity/infrastructure/repositories';
import { MongoCategoryStore, MongoProductStore, MongoWarehouseStore } from '../infrastructure/repositories';
import { createInventoryController } from './controllers';
import { createStockController } from './stockController';
import type { StockDeps } from '../application/stock';
import { MongoStockLedger } from '../infrastructure/stockRepository';
import { MongoIdempotencyStore } from '../../../shared/idempotency';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
  requireTenant,
  type AuthMiddlewareDeps,
} from '../../identity/presentation/middleware';

export function buildInventoryDeps(): InventoryDeps {
  return {
    categories: new MongoCategoryStore(),
    products: new MongoProductStore(),
    warehouses: new MongoWarehouseStore(),
    audit: new MongoAuditSink(),
  };
}

export function buildStockDeps(inventory: InventoryDeps): StockDeps {
  return {
    ledger: new MongoStockLedger(),
    products: inventory.products,
    warehouses: inventory.warehouses,
    idempotency: new MongoIdempotencyStore(),
    audit: inventory.audit,
  };
}

/** Mounted at /api/v1/inventory. */
export function createInventoryRouter(deps: InventoryDeps, auth: AuthMiddlewareDeps, stockDeps: StockDeps = buildStockDeps(deps)) {
  const router = Router();
  const controller = createInventoryController(deps);
  const stock = createStockController(stockDeps);
  const guard = [authenticate(auth), requireTenant()];
  const read = requirePermission(auth, PERMISSIONS.INVENTORY_READ);
  const create = requirePermission(auth, PERMISSIONS.INVENTORY_CREATE);
  const update = requirePermission(auth, PERMISSIONS.INVENTORY_UPDATE);
  const remove = requirePermission(auth, PERMISSIONS.INVENTORY_DELETE);

  router.get('/categories', ...guard, read, controller.listCategories);
  router.post('/categories', ...guard, create, controller.createCategory);
  router.get('/categories/:id', ...guard, read, controller.getCategory);
  router.patch('/categories/:id', ...guard, update, controller.updateCategory);
  router.delete('/categories/:id', ...guard, remove, controller.deleteCategory);

  router.get('/products', ...guard, read, controller.listProducts);
  router.post('/products', ...guard, create, controller.createProduct);
  router.get('/products/:id', ...guard, read, controller.getProduct);
  router.patch('/products/:id', ...guard, update, controller.updateProduct);
  router.delete('/products/:id', ...guard, remove, controller.deleteProduct);

  router.get('/warehouses', ...guard, read, controller.listWarehouses);
  router.post('/warehouses', ...guard, create, controller.createWarehouse);
  router.get('/warehouses/:id', ...guard, read, controller.getWarehouse);
  router.patch('/warehouses/:id', ...guard, update, controller.updateWarehouse);
  router.delete('/warehouses/:id', ...guard, remove, controller.deleteWarehouse);

  // Ledger: balances are a projection of immutable movements.
  router.get('/stock', ...guard, read, stock.listStock);
  router.get('/movements', ...guard, read, stock.listMovements);
  router.post(
    '/movements',
    ...guard,
    requireAnyPermission(auth, [PERMISSIONS.INVENTORY_STOCK_IN, PERMISSIONS.INVENTORY_STOCK_OUT, PERMISSIONS.INVENTORY_STOCK_ADJUST]),
    stock.postMovements,
  );
  router.post('/transfers', ...guard, requirePermission(auth, PERMISSIONS.INVENTORY_TRANSFER), stock.postTransfer);

  return router;
}

/**
 * Inventory controllers — thin HTTP adapters over use cases.
 * Business rules live in Application; errors flow to the global errorHandler.
 */
import type { NextFunction, Request, Response } from 'express';
import type { InventoryActor, InventoryDeps } from '../application/usecases';
import {
  createCategory,
  createProduct,
  createWarehouse,
  deactivateCategory,
  deactivateProduct,
  deactivateWarehouse,
  getCategory,
  getProduct,
  getWarehouse,
  listCategories,
  listProducts,
  listWarehouses,
  updateCategory,
  updateProduct,
  updateWarehouse,
} from '../application/usecases';
import {
  createCategorySchema,
  createProductSchema,
  createWarehouseSchema,
  idParamSchema,
  inventoryQuerySchema,
  updateCategorySchema,
  updateProductSchema,
  updateWarehouseSchema,
} from './schemas';

function actorOf(req: Request): InventoryActor {
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

export function createInventoryController(deps: InventoryDeps) {
  return {
    // -- Categories -------------------------------------------------------
    async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = inventoryQuerySchema.parse(req.query);
        const result = await listCategories(
          actorOf(req),
          { search: query.search, status: query.status },
          query.page,
          query.limit,
          deps,
        );
        ok(res, req, result.data, 200, pagedMeta(result));
      } catch (err) {
        next(err);
      }
    },

    async getCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await getCategory(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createCategorySchema.parse(req.body);
        ok(res, req, await createCategory(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const dto = updateCategorySchema.parse(req.body);
        ok(res, req, await updateCategory(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await deactivateCategory(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    // -- Products ---------------------------------------------------------
    async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = inventoryQuerySchema.parse(req.query);
        const result = await listProducts(
          actorOf(req),
          { search: query.search, categoryId: query.categoryId, status: query.status },
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

    async getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await getProduct(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createProductSchema.parse(req.body);
        ok(res, req, await createProduct(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const dto = updateProductSchema.parse(req.body);
        ok(res, req, await updateProduct(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await deactivateProduct(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    // -- Warehouses -------------------------------------------------------
    async listWarehouses(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = inventoryQuerySchema.parse(req.query);
        const result = await listWarehouses(
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

    async getWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await getWarehouse(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createWarehouseSchema.parse(req.body);
        ok(res, req, await createWarehouse(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        const dto = updateWarehouseSchema.parse(req.body);
        ok(res, req, await updateWarehouse(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteWarehouse(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = idParamSchema.parse(req.params);
        ok(res, req, await deactivateWarehouse(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },
  };
}

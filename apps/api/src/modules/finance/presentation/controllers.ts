/**
 * Finance controllers — thin HTTP adapters over use cases.
 * Business rules live in Application; errors flow to the global errorHandler.
 */
import type { NextFunction, Request, Response } from 'express';
import type { FinanceActor, FinanceDeps } from '../application/usecases';
import {
  createAccount,
  createFinanceCategory,
  createMovement,
  deactivateAccount,
  deactivateFinanceCategory,
  getAccount,
  getFinanceCategory,
  getMovement,
  listAccounts,
  listFinanceCategories,
  listMovements,
  movementTotals,
  updateAccount,
  updateFinanceCategory,
  voidMovement,
} from '../application/usecases';
import {
  accountQuerySchema,
  createAccountSchema,
  createFinanceCategorySchema,
  createMovementSchema,
  financeCategoryQuerySchema,
  financeIdParamSchema,
  movementQuerySchema,
  totalsQuerySchema,
  updateAccountSchema,
  updateFinanceCategorySchema,
  voidMovementSchema,
} from './schemas';

function actorOf(req: Request): FinanceActor {
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

export function createFinanceController(deps: FinanceDeps) {
  return {
    // -- Accounts ---------------------------------------------------------
    async listAccounts(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = accountQuerySchema.parse(req.query);
        const result = await listAccounts(
          actorOf(req),
          { search: query.search, type: query.type, status: query.status },
          query.page,
          query.limit,
          deps,
        );
        ok(res, req, result.data, 200, pagedMeta(result));
      } catch (err) {
        next(err);
      }
    },

    async getAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = financeIdParamSchema.parse(req.params);
        ok(res, req, await getAccount(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createAccountSchema.parse(req.body);
        ok(res, req, await createAccount(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = financeIdParamSchema.parse(req.params);
        const dto = updateAccountSchema.parse(req.body);
        ok(res, req, await updateAccount(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = financeIdParamSchema.parse(req.params);
        ok(res, req, await deactivateAccount(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    // -- Categories -------------------------------------------------------
    async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = financeCategoryQuerySchema.parse(req.query);
        const result = await listFinanceCategories(
          actorOf(req),
          { kind: query.kind, status: query.status },
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
        const params = financeIdParamSchema.parse(req.params);
        ok(res, req, await getFinanceCategory(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createFinanceCategorySchema.parse(req.body);
        ok(res, req, await createFinanceCategory(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = financeIdParamSchema.parse(req.params);
        const dto = updateFinanceCategorySchema.parse(req.body);
        ok(res, req, await updateFinanceCategory(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = financeIdParamSchema.parse(req.params);
        ok(res, req, await deactivateFinanceCategory(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    // -- Movements --------------------------------------------------------
    async listMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = movementQuerySchema.parse(req.query);
        const result = await listMovements(
          actorOf(req),
          {
            accountId: query.accountId,
            categoryId: query.categoryId,
            kind: query.kind,
            status: query.status,
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
          },
          query.page,
          query.limit,
          query.sortBy ?? 'date',
          query.sortOrder,
          deps,
        );
        ok(res, req, result.data, 200, pagedMeta(result));
      } catch (err) {
        next(err);
      }
    },

    async getMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = financeIdParamSchema.parse(req.params);
        ok(res, req, await getMovement(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createMovementSchema.parse(req.body);
        ok(res, req, await createMovement(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async voidMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = financeIdParamSchema.parse(req.params);
        const dto = voidMovementSchema.parse(req.body);
        ok(res, req, await voidMovement(actorOf(req), params.id, dto.expectedVersion, deps));
      } catch (err) {
        next(err);
      }
    },

    async movementTotals(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = totalsQuerySchema.parse(req.query);
        ok(
          res,
          req,
          await movementTotals(actorOf(req), { accountId: query.accountId, dateFrom: query.dateFrom, dateTo: query.dateTo }, deps),
        );
      } catch (err) {
        next(err);
      }
    },
  };
}

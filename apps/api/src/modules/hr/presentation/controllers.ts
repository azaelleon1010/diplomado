/**
 * HR controllers — thin HTTP adapters over use cases.
 * Business rules live in Application; errors flow to the global errorHandler.
 */
import type { NextFunction, Request, Response } from 'express';
import type { HrActor, HrDeps } from '../application/usecases';
import {
  cancelTimeOff,
  createDepartment,
  createEmployee,
  createTimeOff,
  deactivateDepartment,
  deactivateEmployee,
  decideTimeOff,
  getDepartment,
  getEmployee,
  getTimeOff,
  listDepartments,
  listEmployees,
  listTimeOff,
  updateDepartment,
  updateEmployee,
} from '../application/usecases';
import {
  cancelTimeOffSchema,
  createDepartmentSchema,
  createEmployeeSchema,
  createTimeOffSchema,
  decideTimeOffSchema,
  departmentQuerySchema,
  employeeQuerySchema,
  hrIdParamSchema,
  timeOffQuerySchema,
  updateDepartmentSchema,
  updateEmployeeSchema,
} from './schemas';

function actorOf(req: Request): HrActor {
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

export function createHrController(deps: HrDeps) {
  return {
    // -- Departments ------------------------------------------------------
    async listDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = departmentQuerySchema.parse(req.query);
        const result = await listDepartments(actorOf(req), query.page, query.limit, deps);
        ok(res, req, result.data, 200, pagedMeta(result));
      } catch (err) {
        next(err);
      }
    },

    async getDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = hrIdParamSchema.parse(req.params);
        ok(res, req, await getDepartment(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createDepartmentSchema.parse(req.body);
        ok(res, req, await createDepartment(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = hrIdParamSchema.parse(req.params);
        const dto = updateDepartmentSchema.parse(req.body);
        ok(res, req, await updateDepartment(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = hrIdParamSchema.parse(req.params);
        ok(res, req, await deactivateDepartment(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    // -- Employees --------------------------------------------------------
    async listEmployees(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = employeeQuerySchema.parse(req.query);
        const result = await listEmployees(
          actorOf(req),
          { search: query.search, departmentId: query.departmentId, status: query.status },
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

    async getEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = hrIdParamSchema.parse(req.params);
        ok(res, req, await getEmployee(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createEmployeeSchema.parse(req.body);
        ok(res, req, await createEmployee(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async updateEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = hrIdParamSchema.parse(req.params);
        const dto = updateEmployeeSchema.parse(req.body);
        ok(res, req, await updateEmployee(actorOf(req), params.id, dto, deps));
      } catch (err) {
        next(err);
      }
    },

    async deleteEmployee(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = hrIdParamSchema.parse(req.params);
        ok(res, req, await deactivateEmployee(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    // -- Time off ---------------------------------------------------------
    async listTimeOff(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const query = timeOffQuerySchema.parse(req.query);
        const result = await listTimeOff(
          actorOf(req),
          { employeeId: query.employeeId, status: query.status, type: query.type },
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

    async getTimeOff(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = hrIdParamSchema.parse(req.params);
        ok(res, req, await getTimeOff(actorOf(req), params.id, deps));
      } catch (err) {
        next(err);
      }
    },

    async createTimeOff(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const dto = createTimeOffSchema.parse(req.body);
        ok(res, req, await createTimeOff(actorOf(req), dto, deps), 201);
      } catch (err) {
        next(err);
      }
    },

    async decideTimeOff(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = hrIdParamSchema.parse(req.params);
        const dto = decideTimeOffSchema.parse(req.body);
        const ctx = actorOf(req);
        ok(res, req, await decideTimeOff(ctx, params.id, dto.to, dto.expectedVersion, deps));
      } catch (err) {
        next(err);
      }
    },

    async cancelTimeOff(req: Request, res: Response, next: NextFunction): Promise<void> {
      try {
        const params = hrIdParamSchema.parse(req.params);
        const dto = cancelTimeOffSchema.parse(req.body);
        ok(res, req, await cancelTimeOff(actorOf(req), params.id, dto.expectedVersion, deps));
      } catch (err) {
        next(err);
      }
    },
  };
}

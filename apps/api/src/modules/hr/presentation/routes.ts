/**
 * HR routes + composition root.
 * Routers are built from explicit dependencies (no service locator).
 * Auth primitives (authenticate/requireTenant/requirePermission) are reused
 * from the identity module.
 */
import { Router } from 'express';
import type { HrDeps } from '../application/usecases';
import { PERMISSIONS } from '../../identity/domain/permissions';
import { MongoAuditSink } from '../../identity/infrastructure/repositories';
import { MongoDepartmentStore, MongoEmployeeStore, MongoEmployeeUserDirectory, MongoTimeOffStore } from '../infrastructure/repositories';
import { createHrController } from './controllers';
import {
  authenticate,
  requireAnyPermission,
  requirePermission,
  requireTenant,
  type AuthMiddlewareDeps,
} from '../../identity/presentation/middleware';

export function buildHrDeps(): HrDeps {
  return {
    departments: new MongoDepartmentStore(),
    employees: new MongoEmployeeStore(),
    users: new MongoEmployeeUserDirectory(),
    timeOffs: new MongoTimeOffStore(),
    audit: new MongoAuditSink(),
  };
}

/** Mounted at /api/v1/hr. */
export function createHrRouter(deps: HrDeps, auth: AuthMiddlewareDeps) {
  const router = Router();
  const controller = createHrController(deps);
  const guard = [authenticate(auth), requireTenant()];
  const readTeam = requirePermission(auth, PERMISSIONS.HR_READ_TEAM);
  const write = requirePermission(auth, PERMISSIONS.HR_WRITE);
  const timeOffRead = requireAnyPermission(auth, [PERMISSIONS.HR_READ_SELF, PERMISSIONS.HR_READ_TEAM]);
  const timeOffWrite = requireAnyPermission(auth, [PERMISSIONS.HR_WRITE_SELF, PERMISSIONS.HR_WRITE]);

  router.get('/departments', ...guard, readTeam, controller.listDepartments);
  router.post('/departments', ...guard, write, controller.createDepartment);
  router.get('/departments/:id', ...guard, readTeam, controller.getDepartment);
  router.patch('/departments/:id', ...guard, write, controller.updateDepartment);
  router.delete('/departments/:id', ...guard, write, controller.deleteDepartment);

  router.get('/employees', ...guard, readTeam, controller.listEmployees);
  router.post('/employees', ...guard, write, controller.createEmployee);
  router.get('/employees/:id', ...guard, readTeam, controller.getEmployee);
  router.patch('/employees/:id', ...guard, write, controller.updateEmployee);
  router.delete('/employees/:id', ...guard, write, controller.deleteEmployee);

  router.get('/time-off', ...guard, timeOffRead, controller.listTimeOff);
  router.post('/time-off', ...guard, timeOffWrite, controller.createTimeOff);
  router.get('/time-off/:id', ...guard, timeOffRead, controller.getTimeOff);
  router.post('/time-off/:id/decision', ...guard, write, controller.decideTimeOff);
  router.post('/time-off/:id/cancel', ...guard, timeOffWrite, controller.cancelTimeOff);

  return router;
}

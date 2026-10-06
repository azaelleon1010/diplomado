/**
 * HR use cases — orchestrate ports, enforce business rules.
 * No Express, no Mongoose here.
 */
import { AppError } from '@erp/errors';
import { sanitizeForAudit } from '../../identity/domain/entities';
import { hasPermission, PERMISSIONS } from '../../identity/domain/permissions';
import type { IAuditSink } from '../../identity/domain/ports';
import type { AuditResult } from '../../identity/domain/entities';
import {
  HR_ACTIONS,
  type DepartmentStatus,
  type EmployeeStatus,
  type TimeOffStatus,
  type TimeOffType,
} from '../domain/entities';
import type {
  IDepartmentStore,
  IEmployeeStore,
  IEmployeeUserDirectory,
  ITimeOffStore,
} from '../domain/ports';

export interface HrDeps {
  departments: IDepartmentStore;
  employees: IEmployeeStore;
  users: IEmployeeUserDirectory;
  timeOffs: ITimeOffStore;
  audit: IAuditSink;
}

export interface HrActor {
  userId: string;
  tenantId: string;
  permissions: readonly string[];
  correlationId?: string;
}

async function audit(deps: HrDeps, event: { tenantId: string; userId?: string; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; result: AuditResult; correlationId?: string }) {
  await deps.audit.record({
    tenantId: event.tenantId,
    userId: event.userId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    before: sanitizeForAudit(event.before),
    after: sanitizeForAudit(event.after),
    result: event.result,
    correlationId: event.correlationId,
  });
}

function notFound(entity: string): AppError {
  return new AppError({ code: 'NOT_FOUND', message: `${entity} not found`, statusCode: 404 });
}

function duplicate(field: string): AppError {
  return new AppError({ code: 'CONFLICT', message: `Duplicate value for ${field}`, statusCode: 409, fields: { duplicateFields: { [field]: true } } });
}

function invalid(message: string, fields?: Record<string, unknown>): AppError {
  return new AppError({ code: 'VALIDATION_ERROR', message, statusCode: 400, fields });
}

function forbidden(message: string): AppError {
  return new AppError({ code: 'FORBIDDEN', message, statusCode: 403 });
}

function can(ctx: HrActor, permission: string): boolean {
  return hasPermission(ctx.permissions, permission);
}

async function selfEmployee(ctx: HrActor, deps: HrDeps) {
  const employee = await deps.employees.findByUserId(ctx.tenantId, ctx.userId);
  if (!employee) throw forbidden('No employee profile is linked to this account');
  return employee;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function assertDepartmentUsable(deps: HrDeps, tenantId: string, departmentId: string): Promise<void> {
  const department = await deps.departments.findById(tenantId, departmentId);
  if (!department) throw notFound('Department');
  if (department.status !== 'ACTIVE') {
    throw invalid('Department is not active');
  }
}

async function assertEmployeeUsable(deps: HrDeps, tenantId: string, employeeId: string) {
  const employee = await deps.employees.findById(tenantId, employeeId);
  if (!employee) throw notFound('Employee');
  if (employee.status !== 'ACTIVE') {
    throw invalid('Employee is not active');
  }
  return employee;
}

function assertDateRange(startDate: string, endDate: string): void {
  if (startDate > endDate) {
    throw invalid('startDate cannot be after endDate', { startDate, endDate });
  }
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export interface CreateDepartmentInput {
  name: string;
  description?: string;
}

export async function createDepartment(ctx: HrActor, input: CreateDepartmentInput, deps: HrDeps) {
  const name = input.name.trim();
  const existing = await deps.departments.findByName(ctx.tenantId, name);
  if (existing) throw duplicate('name');
  const created = await deps.departments.create({
    tenantId: ctx.tenantId,
    name,
    description: input.description?.trim() || undefined,
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: HR_ACTIONS.DEPARTMENT_CREATED,
    entityType: 'department',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { name: created.name },
  });
  return created;
}

export async function getDepartment(ctx: HrActor, id: string, deps: HrDeps) {
  const department = await deps.departments.findById(ctx.tenantId, id);
  if (!department) throw notFound('Department');
  return department;
}

export async function listDepartments(ctx: HrActor, page: number, limit: number, deps: HrDeps) {
  return deps.departments.list(ctx.tenantId, page, limit);
}

export interface UpdateDepartmentInput {
  name?: string;
  description?: string;
  status?: DepartmentStatus;
  expectedVersion: number;
}

export async function updateDepartment(ctx: HrActor, id: string, input: UpdateDepartmentInput, deps: HrDeps) {
  const before = await deps.departments.findById(ctx.tenantId, id);
  if (!before) throw notFound('Department');
  const { expectedVersion, ...fields } = input;
  const patch: { name?: string; description?: string; status?: DepartmentStatus } = {};
  if (fields.name !== undefined) {
    const name = fields.name.trim();
    if (name !== before.name) {
      const clash = await deps.departments.findByName(ctx.tenantId, name);
      if (clash) throw duplicate('name');
    }
    patch.name = name;
  }
  if (fields.description !== undefined) patch.description = fields.description.trim() || undefined;
  if (fields.status !== undefined) patch.status = fields.status;
  const updated = await deps.departments.update(ctx.tenantId, id, patch, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Department');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: HR_ACTIONS.DEPARTMENT_UPDATED,
    entityType: 'department',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { name: before.name, status: before.status },
    after: { name: updated.name, status: updated.status },
  });
  return updated;
}

export async function deactivateDepartment(ctx: HrActor, id: string, deps: HrDeps) {
  const department = await deps.departments.findById(ctx.tenantId, id);
  if (!department) throw notFound('Department');
  const linked = await deps.departments.countActiveEmployees(ctx.tenantId, id);
  if (linked > 0) {
    throw new AppError({
      code: 'CONFLICT',
      message: `Department has ${linked} active employee(s) and cannot be deactivated`,
      statusCode: 409,
      fields: { activeEmployees: linked },
    });
  }
  const updated = await deps.departments.update(ctx.tenantId, id, { status: 'INACTIVE' }, department.version, ctx.userId);
  if (!updated) throw notFound('Department');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: HR_ACTIONS.DEPARTMENT_DEACTIVATED,
    entityType: 'department',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: department.status },
    after: { status: updated.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------------

export interface CreateEmployeeInput {
  code: string;
  firstName: string;
  lastName: string;
  userId?: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  position?: string;
  location?: string;
  hireDate?: string;
}

export async function createEmployee(ctx: HrActor, input: CreateEmployeeInput, deps: HrDeps) {
  const code = input.code.trim().toUpperCase();
  const existing = await deps.employees.findByCode(ctx.tenantId, code);
  if (existing) throw duplicate('code');
  if (input.departmentId) await assertDepartmentUsable(deps, ctx.tenantId, input.departmentId);
  if (input.email !== undefined && !EMAIL_RE.test(input.email.trim())) {
    throw invalid('Invalid employee email');
  }
  if (input.userId && !(await deps.users.isActiveInTenant(ctx.tenantId, input.userId))) {
    throw notFound('Active tenant user');
  }
  const created = await deps.employees.create({
    tenantId: ctx.tenantId,
    code,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    userId: input.userId?.trim(),
    email: input.email?.trim().toLowerCase() || undefined,
    phone: input.phone?.trim() || undefined,
    departmentId: input.departmentId,
    position: input.position?.trim() || undefined,
    location: input.location?.trim() || undefined,
    hireDate: input.hireDate?.trim() || undefined,
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: HR_ACTIONS.EMPLOYEE_CREATED,
    entityType: 'employee',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { code: created.code, firstName: created.firstName, lastName: created.lastName, userId: created.userId },
  });
  return created;
}

export async function getEmployee(ctx: HrActor, id: string, deps: HrDeps) {
  const employee = await deps.employees.findById(ctx.tenantId, id);
  if (!employee) throw notFound('Employee');
  return employee;
}

export async function listEmployees(ctx: HrActor, filters: { search?: string; departmentId?: string; status?: EmployeeStatus }, page: number, limit: number, sortBy: string, sortOrder: 'asc' | 'desc', deps: HrDeps) {
  return deps.employees.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
}

export interface UpdateEmployeeInput {
  firstName?: string;
  lastName?: string;
  userId?: string | null;
  email?: string | null;
  phone?: string | null;
  departmentId?: string | null;
  position?: string | null;
  location?: string | null;
  hireDate?: string | null;
  status?: EmployeeStatus;
  expectedVersion: number;
}

export async function updateEmployee(ctx: HrActor, id: string, input: UpdateEmployeeInput, deps: HrDeps) {
  const before = await deps.employees.findById(ctx.tenantId, id);
  if (!before) throw notFound('Employee');
  const { expectedVersion, ...fields } = input;
  if (fields.departmentId !== undefined && fields.departmentId !== null) {
    await assertDepartmentUsable(deps, ctx.tenantId, fields.departmentId);
  }
  if (fields.email !== undefined && fields.email !== null && !EMAIL_RE.test(fields.email.trim())) {
    throw invalid('Invalid employee email');
  }
  if (fields.userId && !(await deps.users.isActiveInTenant(ctx.tenantId, fields.userId))) {
    throw notFound('Active tenant user');
  }
  const updated = await deps.employees.update(ctx.tenantId, id, fields, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Employee');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: HR_ACTIONS.EMPLOYEE_UPDATED,
    entityType: 'employee',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { firstName: before.firstName, lastName: before.lastName, status: before.status, userId: before.userId },
    after: { firstName: updated.firstName, lastName: updated.lastName, status: updated.status, userId: updated.userId },
  });
  return updated;
}

export async function deactivateEmployee(ctx: HrActor, id: string, deps: HrDeps) {
  const employee = await deps.employees.findById(ctx.tenantId, id);
  if (!employee) throw notFound('Employee');
  const updated = await deps.employees.update(ctx.tenantId, id, { status: 'INACTIVE' }, employee.version, ctx.userId);
  if (!updated) throw notFound('Employee');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: HR_ACTIONS.EMPLOYEE_DEACTIVATED,
    entityType: 'employee',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: employee.status },
    after: { status: updated.status },
  });
  return updated;
}

// ---------------------------------------------------------------------------
// Time off
// ---------------------------------------------------------------------------

export interface CreateTimeOffInput {
  employeeId?: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  reason?: string;
}

export async function createTimeOff(ctx: HrActor, input: CreateTimeOffInput, deps: HrDeps) {
  let employeeId: string;
  if (can(ctx, PERMISSIONS.HR_WRITE)) {
    if (!input.employeeId) throw invalid('employeeId is required for HR administrators');
    employeeId = input.employeeId;
  } else {
    if (!can(ctx, PERMISSIONS.HR_WRITE_SELF)) throw forbidden('Insufficient permissions');
    const employee = await selfEmployee(ctx, deps);
    employeeId = employee._id;
  }
  await assertEmployeeUsable(deps, ctx.tenantId, employeeId);
  assertDateRange(input.startDate.trim(), input.endDate.trim());
  const created = await deps.timeOffs.create({
    tenantId: ctx.tenantId,
    employeeId,
    type: input.type,
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    reason: input.reason?.trim() || undefined,
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: HR_ACTIONS.TIMEOFF_CREATED,
    entityType: 'timeOff',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { employeeId: created.employeeId, type: created.type, startDate: created.startDate, endDate: created.endDate },
  });
  return created;
}

export async function getTimeOff(ctx: HrActor, id: string, deps: HrDeps) {
  const record = await deps.timeOffs.findById(ctx.tenantId, id);
  if (!record) throw notFound('Time off request');
  if (can(ctx, PERMISSIONS.HR_READ_TEAM)) return record;
  if (!can(ctx, PERMISSIONS.HR_READ_SELF)) throw forbidden('Insufficient permissions');
  const employee = await selfEmployee(ctx, deps);
  if (record.employeeId !== employee._id) throw notFound('Time off request');
  return record;
}

export async function listTimeOff(ctx: HrActor, filters: { employeeId?: string; status?: TimeOffStatus; type?: TimeOffType }, page: number, limit: number, sortBy: string, sortOrder: 'asc' | 'desc', deps: HrDeps) {
  if (can(ctx, PERMISSIONS.HR_READ_TEAM)) {
    return deps.timeOffs.list(ctx.tenantId, filters, page, limit, sortBy, sortOrder);
  }
  if (!can(ctx, PERMISSIONS.HR_READ_SELF)) throw forbidden('Insufficient permissions');
  const employee = await selfEmployee(ctx, deps);
  return deps.timeOffs.list(ctx.tenantId, { ...filters, employeeId: employee._id }, page, limit, sortBy, sortOrder);
}

const DECISION_ACTIONS = {
  APPROVED: HR_ACTIONS.TIMEOFF_APPROVED,
  REJECTED: HR_ACTIONS.TIMEOFF_REJECTED,
} as const;

export async function decideTimeOff(ctx: HrActor, id: string, to: 'APPROVED' | 'REJECTED', expectedVersion: number, deps: HrDeps) {
  const before = await deps.timeOffs.findById(ctx.tenantId, id);
  if (!before) throw notFound('Time off request');
  if (before.status !== 'PENDING') {
    throw invalid(`Time off request in status ${before.status} cannot be decided`);
  }
  const updated = await deps.timeOffs.decide(ctx.tenantId, id, to, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Time off request');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: DECISION_ACTIONS[to],
    entityType: 'timeOff',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: before.status },
    after: { status: updated.status },
  });
  return updated;
}

export async function cancelTimeOff(ctx: HrActor, id: string, expectedVersion: number, deps: HrDeps) {
  const record = await deps.timeOffs.findById(ctx.tenantId, id);
  if (!record) throw notFound('Time off request');
  if (!can(ctx, PERMISSIONS.HR_WRITE)) {
    if (!can(ctx, PERMISSIONS.HR_WRITE_SELF)) throw forbidden('Insufficient permissions');
    const employee = await selfEmployee(ctx, deps);
    if (record.employeeId !== employee._id) throw notFound('Time off request');
  }
  if (record.status !== 'PENDING') {
    throw invalid(`Time off request in status ${record.status} cannot be cancelled`);
  }
  const updated = await deps.timeOffs.cancel(ctx.tenantId, id, expectedVersion, ctx.userId);
  if (!updated) throw notFound('Time off request');
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: HR_ACTIONS.TIMEOFF_CANCELLED,
    entityType: 'timeOff',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { status: record.status },
    after: { status: updated.status },
  });
  return updated;
}

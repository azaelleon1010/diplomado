import { describe, it, expect } from 'vitest';
import {
  cancelTimeOff,
  createDepartment,
  createEmployee,
  createTimeOff,
  deactivateDepartment,
  decideTimeOff,
  getTimeOff,
  listTimeOff,
  updateEmployee,
  type HrDeps,
} from '../../apps/api/src/modules/hr/application/usecases';
import type { IDepartmentStore, IEmployeeStore, ITimeOffStore } from '../../apps/api/src/modules/hr/domain/ports';
import type { Department, Employee, TimeOff } from '../../apps/api/src/modules/hr/domain/entities';
import { PERMISSIONS } from '../../apps/api/src/modules/identity/domain/permissions';

function makeDeps() {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const now = () => new Date();
  const departments = new Map<string, Department>();
  const employees = new Map<string, Employee>();
  const timeOffs = new Map<string, TimeOff>();
  const audits: unknown[] = [];

  const departmentStore: IDepartmentStore = {
    findById: async (tenantId, did) => {
      const d = departments.get(did);
      return d && d.tenantId === tenantId ? d : null;
    },
    findByName: async (tenantId, name) =>
      [...departments.values()].find((d) => d.tenantId === tenantId && d.name === name) ?? null,
    list: async (tenantId) => {
      const data = [...departments.values()].filter((d) => d.tenantId === tenantId);
      return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
    },
    create: async (data) => {
      const d: Department = {
        _id: id('dep'), tenantId: data.tenantId, name: data.name, description: data.description,
        status: 'ACTIVE', createdAt: now(), updatedAt: now(), version: 1,
      };
      departments.set(d._id, d);
      return d;
    },
    update: async (tenantId, did, patch, expectedVersion) => {
      const d = departments.get(did);
      if (!d || d.tenantId !== tenantId) return null;
      if (d.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const next = { ...d, ...patch, version: d.version + 1, updatedAt: now() };
      departments.set(did, next);
      return next;
    },
    countActiveEmployees: async (tenantId, departmentId) =>
      [...employees.values()].filter((e) => e.tenantId === tenantId && e.departmentId === departmentId && e.status === 'ACTIVE').length,
  };

  const employeeStore: IEmployeeStore = {
    findById: async (tenantId, eid) => {
      const e = employees.get(eid);
      return e && e.tenantId === tenantId ? e : null;
    },
    findByUserId: async (tenantId, userId) =>
      [...employees.values()].find((e) => e.tenantId === tenantId && e.userId === userId) ?? null,
    findByCode: async (tenantId, code) =>
      [...employees.values()].find((e) => e.tenantId === tenantId && e.code === code.toUpperCase()) ?? null,
    list: async (tenantId) => {
      const data = [...employees.values()].filter((e) => e.tenantId === tenantId);
      return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
    },
    create: async (data) => {
      const e: Employee = {
        _id: id('emp'), tenantId: data.tenantId, code: data.code.toUpperCase(),
        firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone,
        userId: data.userId,
        departmentId: data.departmentId, position: data.position, location: data.location,
        hireDate: data.hireDate, status: 'ACTIVE', createdAt: now(), updatedAt: now(), version: 1,
      };
      employees.set(e._id, e);
      return e;
    },
    update: async (tenantId, eid, patch, expectedVersion) => {
      const e = employees.get(eid);
      if (!e || e.tenantId !== tenantId) return null;
      if (e.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const { email, phone, departmentId, position, location, hireDate, userId, ...rest } = patch as Record<string, unknown>;
      const next: Employee = {
        ...e,
        ...(rest as Partial<Employee>),
        ...(email !== undefined ? { email: (email as string) ?? undefined } : {}),
        ...(phone !== undefined ? { phone: (phone as string) ?? undefined } : {}),
        ...(departmentId !== undefined ? { departmentId: (departmentId as string) ?? undefined } : {}),
        ...(position !== undefined ? { position: (position as string) ?? undefined } : {}),
        ...(location !== undefined ? { location: (location as string) ?? undefined } : {}),
        ...(hireDate !== undefined ? { hireDate: (hireDate as string) ?? undefined } : {}),
        ...(userId !== undefined ? { userId: (userId as string) ?? undefined } : {}),
        version: e.version + 1,
        updatedAt: now(),
      };
      employees.set(eid, next);
      return next;
    },
  };

  const timeOffStore: ITimeOffStore = {
    findById: async (tenantId, tid) => {
      const t = timeOffs.get(tid);
      return t && t.tenantId === tenantId ? t : null;
    },
    list: async (tenantId, filters) => {
      const data = [...timeOffs.values()].filter((t) =>
        t.tenantId === tenantId &&
        (!filters.employeeId || t.employeeId === filters.employeeId) &&
        (!filters.status || t.status === filters.status) &&
        (!filters.type || t.type === filters.type),
      );
      return { data, total: data.length, page: 1, limit: 20, totalPages: 1 };
    },
    create: async (data) => {
      const t: TimeOff = {
        _id: id('tof'), tenantId: data.tenantId, employeeId: data.employeeId, type: data.type,
        startDate: data.startDate, endDate: data.endDate, reason: data.reason, status: 'PENDING',
        createdAt: now(), updatedAt: now(), version: 1,
      };
      timeOffs.set(t._id, t);
      return t;
    },
    decide: async (tenantId, tid, to, expectedVersion, decidedBy) => {
      const t = timeOffs.get(tid);
      if (!t || t.tenantId !== tenantId) return null;
      if (t.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const next = { ...t, status: to, decidedBy, decidedAt: new Date().toISOString(), version: t.version + 1, updatedAt: now() };
      timeOffs.set(tid, next);
      return next;
    },
    cancel: async (tenantId, tid, expectedVersion, _updatedBy) => {
      const t = timeOffs.get(tid);
      if (!t || t.tenantId !== tenantId) return null;
      if (t.version !== expectedVersion) {
        throw Object.assign(new Error('Version conflict'), { name: 'VersionError' });
      }
      const next = { ...t, status: 'CANCELLED' as const, version: t.version + 1, updatedAt: now() };
      timeOffs.set(tid, next);
      return next;
    },
  };

  const deps: HrDeps = {
    departments: departmentStore,
    employees: employeeStore,
    users: { isActiveInTenant: async () => true },
    timeOffs: timeOffStore,
    audit: { record: async (event) => { audits.push(event); } },
  };
  return { deps, audits, departments, employees, timeOffs };
}

const ctx = {
  userId: 'u-1',
  tenantId: 't-1',
  permissions: [PERMISSIONS.HR_READ_SELF, PERMISSIONS.HR_READ_TEAM, PERMISSIONS.HR_WRITE_SELF, PERMISSIONS.HR_WRITE],
};

describe('hr use cases (fake stores)', () => {
  it('creates departments, employees and time-off with audit trail', async () => {
    const { deps, audits } = makeDeps();
    const department = await createDepartment(ctx, { name: 'Producción' }, deps);
    expect(department.tenantId).toBe('t-1');
    const employee = await createEmployee(
      ctx,
      { code: 'EMP-01', firstName: 'Juan', lastName: 'Pérez', departmentId: department._id },
      deps,
    );
    expect(employee.code).toBe('EMP-01');
    const timeOff = await createTimeOff(
      ctx,
      { employeeId: employee._id, type: 'VACATION', startDate: '2026-12-20', endDate: '2026-12-27' },
      deps,
    );
    expect(timeOff.status).toBe('PENDING');
    expect(audits.length).toBe(3);
  });

  it('enforces uniqueness per tenant and validates references', async () => {
    const { deps } = makeDeps();
    await createDepartment(ctx, { name: 'Ventas' }, deps);
    await expect(createDepartment(ctx, { name: 'Ventas' }, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    await expect(
      createEmployee(ctx, { code: 'E-1', firstName: 'A', lastName: 'B', departmentId: 'missing' }, deps),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    await expect(
      createTimeOff(ctx, { employeeId: 'missing', type: 'SICK', startDate: '2026-10-01', endDate: '2026-10-02' }, deps),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    await expect(
      createTimeOff(ctx, { employeeId: 'missing', type: 'SICK', startDate: '2026-10-05', endDate: '2026-10-01' }, deps),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('runs approve/reject/cancel with terminal guards', async () => {
    const { deps } = makeDeps();
    const employee = await createEmployee(ctx, { code: 'E-1', firstName: 'A', lastName: 'B' }, deps);
    const request = await createTimeOff(
      ctx,
      { employeeId: employee._id, type: 'VACATION', startDate: '2026-12-20', endDate: '2026-12-22' },
      deps,
    );
    const approved = await decideTimeOff(ctx, request._id, 'APPROVED', 1, deps);
    expect(approved.status).toBe('APPROVED');
    await expect(decideTimeOff(ctx, request._id, 'REJECTED', 2, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    await expect(cancelTimeOff(ctx, request._id, 2, deps)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    const second = await createTimeOff(
      ctx,
      { employeeId: employee._id, type: 'PERMISSION', startDate: '2026-11-01', endDate: '2026-11-01' },
      deps,
    );
    const cancelled = await cancelTimeOff(ctx, second._id, 1, deps);
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('scopes self-service time-off reads, creation and cancellation to the linked employee', async () => {
    const { deps } = makeDeps();
    const ownEmployee = await createEmployee(ctx, { code: 'SELF', firstName: 'Self', lastName: 'User', userId: 'u-self' }, deps);
    const otherEmployee = await createEmployee(ctx, { code: 'OTHER', firstName: 'Other', lastName: 'User', userId: 'u-other' }, deps);
    const otherRequest = await createTimeOff(ctx, {
      employeeId: otherEmployee._id, type: 'VACATION', startDate: '2026-12-20', endDate: '2026-12-22',
    }, deps);
    const selfRequest = await createTimeOff(ctx, {
      employeeId: ownEmployee._id, type: 'SICK', startDate: '2026-11-01', endDate: '2026-11-02',
    }, deps);
    const selfCtx = {
      userId: 'u-self', tenantId: 't-1',
      permissions: [PERMISSIONS.HR_READ_SELF, PERMISSIONS.HR_WRITE_SELF],
    };

    const filtered = await listTimeOff(selfCtx, { employeeId: otherEmployee._id }, 1, 20, 'createdAt', 'desc', deps);
    expect(filtered.data.map((request) => request.employeeId)).toEqual([ownEmployee._id]);
    await expect(getTimeOff(selfCtx, otherRequest._id, deps)).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });

    const forged = await createTimeOff(selfCtx, {
      employeeId: otherEmployee._id, type: 'PERMISSION', startDate: '2026-10-20', endDate: '2026-10-20',
    }, deps);
    expect(forged.employeeId).toBe(ownEmployee._id);
    await expect(cancelTimeOff(selfCtx, otherRequest._id, 1, deps)).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    await expect(cancelTimeOff(selfCtx, selfRequest._id, 1, deps)).resolves.toMatchObject({ status: 'CANCELLED' });

    const unlinkedCtx = {
      userId: 'u-unlinked', tenantId: 't-1',
      permissions: [PERMISSIONS.HR_READ_SELF, PERMISSIONS.HR_WRITE_SELF],
    };
    await expect(listTimeOff(unlinkedCtx, {}, 1, 20, 'createdAt', 'desc', deps)).rejects.toMatchObject({
      code: 'FORBIDDEN', statusCode: 403,
    });
    await expect(createTimeOff(unlinkedCtx, {
      employeeId: ownEmployee._id, type: 'SICK', startDate: '2026-10-22', endDate: '2026-10-22',
    }, deps)).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    const readOnlyCtx = { ...selfCtx, permissions: [PERMISSIONS.HR_READ_SELF] };
    await expect(createTimeOff(readOnlyCtx, {
      employeeId: otherEmployee._id, type: 'SICK', startDate: '2026-10-22', endDate: '2026-10-22',
    }, deps)).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
    await expect(cancelTimeOff(readOnlyCtx, forged._id, forged.version, deps)).rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });

    const adminRead = await listTimeOff(ctx, {}, 1, 20, 'createdAt', 'desc', deps);
    expect(adminRead.data.length).toBe(3);
    await expect(getTimeOff(ctx, otherRequest._id, deps)).resolves.toEqual(otherRequest);
  });

  it('blocks department deactivation with active employees and isolates tenants', async () => {
    const { deps } = makeDeps();
    const department = await createDepartment(ctx, { name: 'Ventas' }, deps);
    await createEmployee(ctx, { code: 'E-1', firstName: 'A', lastName: 'B', departmentId: department._id }, deps);
    await expect(deactivateDepartment(ctx, department._id, deps)).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
    const other = await createEmployee({ ...ctx, tenantId: 't-2' }, { code: 'E-1', firstName: 'C', lastName: 'D' }, deps);
    expect(other.tenantId).toBe('t-2');
    await expect(updateEmployee({ ...ctx, tenantId: 't-2' }, other._id, { position: 'X', expectedVersion: 1 }, deps)).resolves.toBeTruthy();
  });
});

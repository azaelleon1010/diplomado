import { describe, it, expect } from 'vitest';
import { openApiSpec } from '../../apps/api/src/openapi';
import type { InventoryRequestOptions } from '../../packages/types/src/inventory';
import { createHrApi, describeHrError, timeOffActions } from '../../packages/types/src/hr';

/** "/api/v1/hr/time-off/abc/decision" → "/hr/time-off/{id}/decision". */
function toSpecPath(path: string): string {
  return path
    .replace(/^\/api\/v1/, '')
    .split('?')[0]!
    .split('/')
    .map((segment, i, all) => (i > 0 && segment === 'ID' ? '{id}' : segment) || all[i]!)
    .join('/');
}

describe('shared HR client contract', () => {
  it('only calls operations documented by the API (method + path)', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    const record = async (path: string, options: InventoryRequestOptions) => {
      calls.push({ method: options.method ?? 'GET', path });
      return {} as never;
    };
    const api = createHrApi({ request: record, page: async (path, options) => ({ data: (await record(path, options)) ?? [] }) });
    const t = 'tok';
    await api.listDepartments(t, { search: 'x' });
    await api.createDepartment(t, { name: 'Ventas' });
    await api.updateDepartment(t, 'ID', { expectedVersion: 1 });
    await api.deactivateDepartment(t, 'ID');
    await api.listEmployees(t, { search: 'x' });
    await api.getEmployee(t, 'ID');
    await api.createEmployee(t, { code: 'E1', firstName: 'Ana', lastName: 'Pérez' });
    await api.updateEmployee(t, 'ID', { expectedVersion: 1 });
    await api.deactivateEmployee(t, 'ID');
    await api.listTimeOff(t, { status: 'PENDING' });
    await api.getTimeOff(t, 'ID');
    await api.createTimeOff(t, { employeeId: 'e', type: 'VACATION', startDate: '2026-01-01', endDate: '2026-01-05' });
    await api.decideTimeOff(t, 'ID', 'APPROVED', 1);
    await api.cancelTimeOff(t, 'ID', 1);

    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
    const undocumented = calls.filter((c) => !paths[toSpecPath(c.path)]?.[c.method.toLowerCase()]).map((c) => `${c.method} ${c.path}`);
    expect(undocumented).toEqual([]);
    expect(calls).toHaveLength(14);
  });

  it('shows time-off actions with the same permissions the API enforces', () => {
    expect(timeOffActions({ status: 'PENDING' }, ['hr.write'])).toEqual(['DECIDE', 'CANCEL']);
    expect(timeOffActions({ status: 'PENDING' }, ['hr.write.self'])).toEqual(['CANCEL']);
    expect(timeOffActions({ status: 'PENDING' }, [])).toEqual([]);
    expect(timeOffActions({ status: 'APPROVED' }, ['hr.write'])).toEqual([]);
    expect(timeOffActions({ status: 'PENDING' }, ['*'])).toEqual(['DECIDE', 'CANCEL']);
  });

  it('shows Spanish error messages for business errors', () => {
    expect(describeHrError({ code: 'VERSION_CONFLICT' })).toContain('Otro usuario');
    expect(describeHrError({ code: 'VALIDATION_ERROR', message: 'employeeId is required for HR administrators' })).toContain('Selecciona el empleado');
    expect(describeHrError({ code: 'OTHER' })).toBeNull();
  });
});

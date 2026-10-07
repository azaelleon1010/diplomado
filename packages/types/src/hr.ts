/**
 * Shared HR contract for the Web client.
 *
 * Mirrors apps/api/src/modules/hr. The API enforces every rule
 * (permissions, self-service scoping); the action helpers here only
 * decide which buttons to show. Deliberately free of payroll data —
 * see apps/api/src/modules/hr/domain/entities.ts.
 *
 * Mobile still has its own hand-written DTOs in apps/mobile/src/lib/api.ts
 * (hrApi); this module is the first shared contract for the module and is
 * meant to replace that duplication in a later, dedicated change — not
 * part of this one, to keep the diff reviewable.
 */
import type { InventoryRequestClient, InventoryRequestOptions } from './inventory';
import { hasPermission } from './permissions';

export type HrRequestClient = InventoryRequestClient;
type Options = InventoryRequestOptions;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';

export interface Department {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: DepartmentStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export interface Employee {
  _id: string;
  tenantId: string;
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
  status: EmployeeStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const EMPLOYEE_STATUS: Readonly<Record<EmployeeStatus, { label: string; tone: Tone }>> = {
  ACTIVE: { label: 'Activo', tone: 'success' },
  ON_LEAVE: { label: 'Ausente', tone: 'warning' },
  INACTIVE: { label: 'Inactivo', tone: 'neutral' },
};

export type TimeOffType = 'VACATION' | 'SICK' | 'PERMISSION';
export type TimeOffStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface TimeOff {
  _id: string;
  tenantId: string;
  employeeId: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  status: TimeOffStatus;
  reason?: string;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const TIMEOFF_TYPE: Readonly<Record<TimeOffType, string>> = {
  VACATION: 'Vacaciones',
  SICK: 'Incapacidad',
  PERMISSION: 'Permiso',
};

export const TIMEOFF_STATUS: Readonly<Record<TimeOffStatus, { label: string; tone: Tone }>> = {
  PENDING: { label: 'Pendiente', tone: 'warning' },
  APPROVED: { label: 'Aprobada', tone: 'success' },
  REJECTED: { label: 'Rechazada', tone: 'danger' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

export type TimeOffAction = 'DECIDE' | 'CANCEL';

/**
 * Actions the current user may attempt (same rules as the API): deciding
 * requires hr.write (team), cancelling requires hr.write or hr.write.self —
 * the server additionally restricts "self" to the requester's own employee,
 * which this helper cannot see, so the API is the final authority.
 */
export function timeOffActions(record: Pick<TimeOff, 'status'>, permissions: readonly string[]): TimeOffAction[] {
  if (record.status !== 'PENDING') return [];
  const actions: TimeOffAction[] = [];
  if (hasPermission(permissions, 'hr.write')) actions.push('DECIDE');
  if (hasPermission(permissions, 'hr.write') || hasPermission(permissions, 'hr.write.self')) actions.push('CANCEL');
  return actions;
}

/** Spanish messages for HR business errors (API messages are technical English). */
export function describeHrError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  const text = typeof message === 'string' ? message : '';
  if (code === 'VERSION_CONFLICT') return 'Otro usuario modificó este registro. Recarga para ver la versión más reciente.';
  if (code === 'FORBIDDEN') return 'Tu rol no permite realizar esta acción.';
  if (code === 'VALIDATION_ERROR' && text.toLowerCase().includes('employeeid is required')) return 'Selecciona el empleado para esta solicitud.';
  if (code === 'VALIDATION_ERROR' && text.toLowerCase().includes('date range')) return 'La fecha final debe ser igual o posterior a la fecha inicial.';
  if (code === 'CONFLICT' && text.toLowerCase().includes('status')) return 'Esta solicitud ya fue decidida o cancelada.';
  if (code === 'CONFLICT' && text.toLowerCase().includes('code')) return 'Ese código ya existe.';
  if (code === 'NOT_FOUND') return 'El registro no existe.';
  return null;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const BASE = '/api/v1/hr';

function query(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '' && value !== false)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

const enc = encodeURIComponent;

export function createHrApi(client: HrRequestClient) {
  async function page<T>(path: string, token: string): Promise<Page<T>> {
    const result = await client.page<T[]>(path, { token });
    const items = Array.isArray(result.data) ? result.data : [];
    const num = (k: string, d: number) => (typeof result.meta?.[k] === 'number' ? (result.meta[k] as number) : d);
    return { items, total: num('total', items.length), page: num('page', 1), limit: num('limit', items.length), totalPages: num('totalPages', 1) };
  }
  const get = <T>(path: string, token: string) => client.request<T>(path, { token });
  const send = <T>(path: string, token: string, body?: unknown, method: Options['method'] = 'POST') => client.request<T>(path, { method, token, body });

  return {
    // Departments
    listDepartments: (token: string, params: { search?: string } = {}) => page<Department>(`${BASE}/departments${query({ ...params, page: 1, limit: 100 })}`, token),
    createDepartment: (token: string, body: { name: string; description?: string }) => send<Department>(`${BASE}/departments`, token, body),
    updateDepartment: (token: string, id: string, body: Record<string, unknown> & { expectedVersion: number }) => send<Department>(`${BASE}/departments/${enc(id)}`, token, body, 'PATCH'),
    deactivateDepartment: (token: string, id: string) => send<Department>(`${BASE}/departments/${enc(id)}`, token, undefined, 'DELETE'),

    // Employees
    listEmployees: (token: string, params: { search?: string; departmentId?: string; status?: EmployeeStatus; page?: number; limit?: number } = {}) =>
      page<Employee>(`${BASE}/employees${query({ ...params, page: params.page ?? 1, limit: params.limit ?? 100 })}`, token),
    getEmployee: (token: string, id: string) => get<Employee>(`${BASE}/employees/${enc(id)}`, token),
    createEmployee: (
      token: string,
      body: { code: string; firstName: string; lastName: string; userId?: string; email?: string; phone?: string; departmentId?: string; position?: string; location?: string; hireDate?: string },
    ) => send<Employee>(`${BASE}/employees`, token, body),
    updateEmployee: (token: string, id: string, body: Record<string, unknown> & { expectedVersion: number }) => send<Employee>(`${BASE}/employees/${enc(id)}`, token, body, 'PATCH'),
    deactivateEmployee: (token: string, id: string) => send<Employee>(`${BASE}/employees/${enc(id)}`, token, undefined, 'DELETE'),

    // Time off
    listTimeOff: (token: string, params: { employeeId?: string; status?: TimeOffStatus; type?: TimeOffType; page?: number; limit?: number } = {}) =>
      page<TimeOff>(`${BASE}/time-off${query({ ...params, page: params.page ?? 1, limit: params.limit ?? 100 })}`, token),
    getTimeOff: (token: string, id: string) => get<TimeOff>(`${BASE}/time-off/${enc(id)}`, token),
    createTimeOff: (token: string, body: { employeeId?: string; type: TimeOffType; startDate: string; endDate: string; reason?: string }) => send<TimeOff>(`${BASE}/time-off`, token, body),
    decideTimeOff: (token: string, id: string, to: 'APPROVED' | 'REJECTED', expectedVersion: number) => send<TimeOff>(`${BASE}/time-off/${enc(id)}/decision`, token, { to, expectedVersion }),
    cancelTimeOff: (token: string, id: string, expectedVersion: number) => send<TimeOff>(`${BASE}/time-off/${enc(id)}/cancel`, token, { expectedVersion }),
  };
}

export type HrApi = ReturnType<typeof createHrApi>;

/** Shared, platform-independent dashboard queries and metric transformations. */
export type DashboardAreaId = 'inventory' | 'production' | 'purchasing' | 'maintenance' | 'hr' | 'finance' | 'system';
export type DashboardAreaState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden' | 'unavailable';

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  accent: 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  count?: number;
}

interface DashboardPage<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface DashboardRequestClient {
  request<T>(path: string, token: string): Promise<T>;
  page<T>(path: string, token: string): Promise<DashboardPage<T>>;
}

export const DASHBOARD_AREA_PERMISSIONS: Readonly<Record<DashboardAreaId, readonly string[] | null>> = {
  inventory: ['inventory.read'],
  production: ['production.read'],
  purchasing: ['purchasing.read'],
  maintenance: ['maintenance.read'],
  hr: ['hr.read.team', 'hr.read.self'],
  finance: ['finance.read'],
  system: null,
};

export function getVisibleDashboardAreas(permissions: readonly string[]): DashboardAreaId[] {
  return (Object.keys(DASHBOARD_AREA_PERMISSIONS) as DashboardAreaId[]).filter((area) => {
    const required = DASHBOARD_AREA_PERMISSIONS[area];
    return required === null || permissions.includes('*') || required.some((permission) => permissions.includes(permission));
  });
}

export class DashboardUnavailableError extends Error {
  constructor() {
    super('La API no devolvió el total de la consulta.');
    this.name = 'DashboardUnavailableError';
  }
}

export function dashboardAreaStateForError(error: unknown): Extract<DashboardAreaState, 'error' | 'forbidden' | 'unavailable'> {
  if (error instanceof DashboardUnavailableError) return 'unavailable';
  if (error && typeof error === 'object') {
    const status = (error as { status?: unknown }).status;
    const message = (error as { message?: unknown }).message;
    if (status === 403) return 'forbidden';
    if (status === 501 || (status === 404 && typeof message === 'string' && /^Route (GET|POST|PATCH|PUT|DELETE) \/api\/v1\//.test(message))) {
      return 'unavailable';
    }
  }
  return 'error';
}

export function dashboardAreaIsEmpty(metrics: readonly DashboardMetric[]): boolean {
  return metrics.length === 0 || metrics.every((metric) => metric.count !== undefined && metric.count === 0);
}

export function dashboardAreaStateForMetrics(metrics: readonly DashboardMetric[]): Extract<DashboardAreaState, 'ready' | 'empty'> {
  return dashboardAreaIsEmpty(metrics) ? 'empty' : 'ready';
}

function countMetric(id: string, label: string, count: number, subtitle: string, accent: DashboardMetric['accent'] = 'info'): DashboardMetric {
  return { id, label, value: count.toLocaleString('es-MX'), subtitle, accent, count };
}

function queryPath(path: string, params: Record<string, string>): string {
  const query = { ...params, page: '1', limit: '1' };
  const encoded = Object.entries(query).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');
  return `${path}?${encoded}`;
}

export function createDashboardApi(client: DashboardRequestClient) {
  async function countFor(path: string, params: Record<string, string>, token: string): Promise<number> {
    const result = await client.page<unknown[]>(queryPath(path, params), token);
    const total = result.meta?.total;
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) throw new DashboardUnavailableError();
    return total;
  }

  async function statusMetric(path: string, status: string, label: string, token: string, subtitle: string): Promise<DashboardMetric> {
    return countMetric(status.toLowerCase(), label, await countFor(path, { status }, token), subtitle);
  }

  return {
    async inventory(token: string): Promise<DashboardMetric[]> {
      const [products, warehouses] = await Promise.all([
        countFor('/api/v1/inventory/products', { status: 'ACTIVE' }, token),
        countFor('/api/v1/inventory/warehouses', { status: 'ACTIVE' }, token),
      ]);
      return [
        countMetric('active-products', 'Productos activos', products, 'Catálogo de inventario'),
        countMetric('active-warehouses', 'Almacenes activos', warehouses, 'Ubicaciones registradas'),
      ];
    },
    async production(token: string): Promise<DashboardMetric[]> {
      return [await statusMetric('/api/v1/production/orders', 'IN_PROGRESS', 'En proceso', token, 'Órdenes IN_PROGRESS')];
    },
    async purchasing(token: string): Promise<DashboardMetric[]> {
      return [await statusMetric('/api/v1/purchasing/orders', 'APPROVED', 'Órdenes aprobadas', token, 'Órdenes APPROVED')];
    },
    async maintenance(token: string): Promise<DashboardMetric[]> {
      const [open, critical] = await Promise.all([
        countFor('/api/v1/maintenance/orders', { status: 'OPEN' }, token),
        countFor('/api/v1/maintenance/orders', { status: 'OPEN', priority: 'CRITICAL' }, token),
      ]);
      return [
        countMetric('open-orders', 'Órdenes abiertas', open, 'Órdenes OPEN'),
        countMetric('open-critical-orders', 'Críticas abiertas', critical, 'Prioridad CRITICAL y estado OPEN', 'danger'),
      ];
    },
    async hr(token: string, permissions: readonly string[]): Promise<DashboardMetric[]> {
      const teamAccess = permissions.includes('*') || permissions.includes('hr.read.team');
      const [employees, pendingRequests] = await Promise.all([
        teamAccess ? countFor('/api/v1/hr/employees', { status: 'ACTIVE' }, token) : Promise.resolve(undefined),
        countFor('/api/v1/hr/time-off', { status: 'PENDING' }, token),
      ]);
      return [
        ...(employees === undefined ? [] : [countMetric('active-employees', 'Empleados activos', employees, 'Alcance de equipo')]),
        countMetric('pending-time-off', teamAccess ? 'Solicitudes pendientes' : 'Mis solicitudes pendientes', pendingRequests, teamAccess ? 'Solicitudes del equipo' : 'Alcance personal'),
      ];
    },
    async finance(token: string): Promise<DashboardMetric[]> {
      return [await statusMetric('/api/v1/finance/movements', 'POSTED', 'Movimientos registrados', token, 'Movimientos POSTED')];
    },
    async system(token: string): Promise<DashboardMetric[]> {
      const health = await client.request<{ status?: string }>('/api/v1/health/live', token);
      const operational = health.status === 'ok';
      return [{
        id: 'api-status',
        label: 'API',
        value: operational ? 'Operativa' : 'Estado desconocido',
        subtitle: 'Comprobación de disponibilidad',
        accent: operational ? 'success' : 'warning',
      }];
    },
  };
}

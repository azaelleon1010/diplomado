/**
 * Shared maintenance contract for the Web client.
 *
 * Mirrors apps/api/src/modules/maintenance. The API enforces every rule
 * (permissions, transitions); the action helpers here only decide which
 * buttons to show.
 *
 * Mobile still has its own hand-written DTOs in apps/mobile/src/lib/api.ts
 * (maintenanceApi); this module is the first shared contract for the
 * module and is meant to replace that duplication in a later, dedicated
 * change — not part of this one, to keep the diff reviewable.
 */
import type { InventoryRequestClient, InventoryRequestOptions } from './inventory';
import { hasPermission } from './permissions';

export type MaintenanceRequestClient = InventoryRequestClient;
type Options = InventoryRequestOptions;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type AssetStatus = 'ACTIVE' | 'IN_MAINTENANCE' | 'OUT_OF_SERVICE' | 'RETIRED';

export interface Asset {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  type: string;
  location?: string;
  responsible?: string;
  status: AssetStatus;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const ASSET_STATUS: Readonly<Record<AssetStatus, { label: string; tone: Tone }>> = {
  ACTIVE: { label: 'Activo', tone: 'success' },
  IN_MAINTENANCE: { label: 'En mantenimiento', tone: 'warning' },
  OUT_OF_SERVICE: { label: 'Fuera de servicio', tone: 'danger' },
  RETIRED: { label: 'Retirado', tone: 'neutral' },
};

export type MaintenanceOrderStatus = 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE';
export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface MaintenanceOrder {
  _id: string;
  tenantId: string;
  assetId: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  title: string;
  description?: string;
  status: MaintenanceOrderStatus;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  cost: number;
  assignedTo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const MAINTENANCE_ORDER_STATUS: Readonly<Record<MaintenanceOrderStatus, { label: string; tone: Tone }>> = {
  OPEN: { label: 'Abierta', tone: 'warning' },
  IN_PROGRESS: { label: 'En curso', tone: 'info' },
  ON_HOLD: { label: 'En espera', tone: 'neutral' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

export const MAINTENANCE_TYPE: Readonly<Record<MaintenanceType, string>> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
};

export const MAINTENANCE_PRIORITY: Readonly<Record<MaintenancePriority, { label: string; tone: Tone }>> = {
  LOW: { label: 'Baja', tone: 'neutral' },
  MEDIUM: { label: 'Media', tone: 'info' },
  HIGH: { label: 'Alta', tone: 'warning' },
  CRITICAL: { label: 'Crítica', tone: 'danger' },
};

export type MaintenanceAction = 'START' | 'HOLD' | 'COMPLETE' | 'CANCEL';

/**
 * Actions the current user may attempt (same rules as the API): the
 * maintenance router only checks maintenance.update for every transition
 * and maintenance.delete for cancellation — maintenance.assign/execute/
 * close exist in the permission catalog but are not wired to a route yet.
 */
export function maintenanceOrderActions(order: Pick<MaintenanceOrder, 'status'>, permissions: readonly string[]): MaintenanceAction[] {
  const can = (p: string) => hasPermission(permissions, p);
  const actions: MaintenanceAction[] = [];
  if (!can('maintenance.update') && !can('maintenance.delete')) return actions;
  if ((order.status === 'OPEN' || order.status === 'ON_HOLD') && can('maintenance.update')) actions.push('START');
  if (order.status === 'IN_PROGRESS' && can('maintenance.update')) actions.push('HOLD', 'COMPLETE');
  if (['OPEN', 'IN_PROGRESS', 'ON_HOLD'].includes(order.status) && can('maintenance.delete')) actions.push('CANCEL');
  return actions;
}

/** Spanish messages for maintenance business errors (API messages are technical English). */
export function describeMaintenanceError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  const text = typeof message === 'string' ? message : '';
  if (code === 'VERSION_CONFLICT') return 'Otro usuario modificó este registro. Recarga para ver la versión más reciente.';
  if (code === 'FORBIDDEN') return 'Tu rol no permite realizar esta acción.';
  if (code === 'CONFLICT' && text.toLowerCase().includes('open order')) return 'El activo tiene órdenes abiertas; cierra o cancela esas órdenes antes de retirarlo.';
  if (code === 'CONFLICT' && text.toLowerCase().includes('code')) return 'Ese código de activo ya existe.';
  if (code === 'CONFLICT') return 'La orden no puede completar esa transición desde su estado actual.';
  if (code === 'NOT_FOUND' && text.toLowerCase().includes('asset')) return 'El activo no existe.';
  return null;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const BASE = '/api/v1/maintenance';

function query(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '' && value !== false)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

const enc = encodeURIComponent;

export function createMaintenanceApi(client: MaintenanceRequestClient) {
  async function page<T>(path: string, token: string): Promise<Page<T>> {
    const result = await client.page<T[]>(path, { token });
    const items = Array.isArray(result.data) ? result.data : [];
    const num = (k: string, d: number) => (typeof result.meta?.[k] === 'number' ? (result.meta[k] as number) : d);
    return { items, total: num('total', items.length), page: num('page', 1), limit: num('limit', items.length), totalPages: num('totalPages', 1) };
  }
  const get = <T>(path: string, token: string) => client.request<T>(path, { token });
  const send = <T>(path: string, token: string, body?: unknown, method: Options['method'] = 'POST') => client.request<T>(path, { method, token, body });

  return {
    // Assets
    listAssets: (token: string, params: { search?: string; status?: AssetStatus; type?: string } = {}) =>
      page<Asset>(`${BASE}/assets${query({ ...params, page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' })}`, token),
    getAsset: (token: string, id: string) => get<Asset>(`${BASE}/assets/${enc(id)}`, token),
    createAsset: (token: string, body: { code: string; name: string; type: string; location?: string; responsible?: string; purchaseDate?: string; warrantyUntil?: string; notes?: string }) =>
      send<Asset>(`${BASE}/assets`, token, body),
    updateAsset: (token: string, id: string, body: Record<string, unknown> & { expectedVersion: number }) =>
      send<Asset>(`${BASE}/assets/${enc(id)}`, token, body, 'PATCH'),
    retireAsset: (token: string, id: string) => send<Asset>(`${BASE}/assets/${enc(id)}`, token, undefined, 'DELETE'),

    // Orders
    listOrders: (token: string, params: { assetId?: string; status?: MaintenanceOrderStatus; priority?: MaintenancePriority; type?: MaintenanceType; page?: number; limit?: number } = {}) =>
      page<MaintenanceOrder>(`${BASE}/orders${query({ ...params, page: params.page ?? 1, limit: params.limit ?? 50 })}`, token),
    getOrder: (token: string, id: string) => get<MaintenanceOrder>(`${BASE}/orders/${enc(id)}`, token),
    createOrder: (
      token: string,
      body: { assetId: string; type: MaintenanceType; priority: MaintenancePriority; title: string; description?: string; scheduledFor?: string; cost?: number; assignedTo?: string; notes?: string },
    ) => send<MaintenanceOrder>(`${BASE}/orders`, token, body),
    transitionOrder: (token: string, id: string, to: 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED', expectedVersion: number, completedCost?: number) =>
      send<MaintenanceOrder>(`${BASE}/orders/${enc(id)}/transition`, token, completedCost === undefined ? { to, expectedVersion } : { to, expectedVersion, completedCost }),
    cancelOrder: (token: string, id: string) => send<MaintenanceOrder>(`${BASE}/orders/${enc(id)}`, token, undefined, 'DELETE'),
  };
}

export type MaintenanceApi = ReturnType<typeof createMaintenanceApi>;

/**
 * Shared production contract for the Web client.
 *
 * Mirrors apps/api/src/modules/production. The API enforces every rule
 * (permissions, transitions, idempotency); the action helpers here only
 * decide which buttons to show. Finished goods and materials always
 * reference the inventory catalog (never a duplicated one).
 *
 * Mobile still has its own hand-written DTOs in apps/mobile/src/lib/api.ts
 * (productionApi); this module is the first shared contract for the
 * module and is meant to replace that duplication in a later, dedicated
 * change — not part of this one, to keep the diff reviewable.
 */
import type { InventoryRequestClient, InventoryRequestOptions } from './inventory';
import { hasPermission } from './permissions';

export type ProductionRequestClient = InventoryRequestClient;
type Options = InventoryRequestOptions;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ProductionOrderStatus = 'DRAFT' | 'RELEASED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface ProductionMaterial {
  productId: string;
  quantityRequired: number;
  quantityConsumed: number;
}

export interface ProductionOrder {
  _id: string;
  tenantId: string;
  code: string;
  productId: string;
  quantity: number;
  producedQuantity: number;
  status: ProductionOrderStatus;
  machine?: string;
  responsible?: string;
  dueDate?: string;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
  materials: ProductionMaterial[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const PRODUCTION_ORDER_STATUS: Readonly<Record<ProductionOrderStatus, { label: string; tone: Tone }>> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  RELEASED: { label: 'Liberada', tone: 'info' },
  IN_PROGRESS: { label: 'En proceso', tone: 'info' },
  PAUSED: { label: 'Pausada', tone: 'warning' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'danger' },
};

export type ProductionAction = 'RELEASE' | 'START' | 'PAUSE' | 'COMPLETE' | 'CANCEL';

/**
 * Actions the current user may attempt (same rules as the API): the
 * production router only checks production.update for every transition
 * and production.delete for cancellation — production.approve/execute/
 * cancel exist in the permission catalog but are not wired to a route yet.
 */
export function productionOrderActions(order: Pick<ProductionOrder, 'status'>, permissions: readonly string[]): ProductionAction[] {
  const can = (p: string) => hasPermission(permissions, p);
  const actions: ProductionAction[] = [];
  if (!can('production.update') && !can('production.delete')) return actions;
  if (order.status === 'DRAFT' && can('production.update')) actions.push('RELEASE');
  if ((order.status === 'RELEASED' || order.status === 'PAUSED') && can('production.update')) actions.push('START');
  if (order.status === 'IN_PROGRESS' && can('production.update')) actions.push('PAUSE', 'COMPLETE');
  if (['DRAFT', 'RELEASED', 'PAUSED'].includes(order.status) && can('production.delete')) actions.push('CANCEL');
  return actions;
}

export function progressPercent(order: Pick<ProductionOrder, 'quantity' | 'producedQuantity'>): number {
  if (order.quantity <= 0) return 0;
  return Math.min(100, Math.round((order.producedQuantity / order.quantity) * 100));
}

/** Spanish messages for production business errors (API messages are technical English). */
export function describeProductionError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  const text = typeof message === 'string' ? message : '';
  if (code === 'VERSION_CONFLICT') return 'Otro usuario modificó esta orden. Recarga para ver la versión más reciente.';
  if (code === 'FORBIDDEN') return 'Tu rol no permite realizar esta acción.';
  if (code === 'CONFLICT' && text.toLowerCase().includes('code')) return 'Ese código de orden ya existe.';
  if (code === 'CONFLICT') return 'La orden no puede completar esa transición desde su estado actual.';
  if (code === 'NOT_FOUND' && text.toLowerCase().includes('product')) return 'El producto no existe en el catálogo.';
  return null;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const BASE = '/api/v1/production';

function query(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '' && value !== false)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

const enc = encodeURIComponent;

export function createProductionApi(client: ProductionRequestClient) {
  async function page<T>(path: string, token: string): Promise<Page<T>> {
    const result = await client.page<T[]>(path, { token });
    const items = Array.isArray(result.data) ? result.data : [];
    const num = (k: string, d: number) => (typeof result.meta?.[k] === 'number' ? (result.meta[k] as number) : d);
    return { items, total: num('total', items.length), page: num('page', 1), limit: num('limit', items.length), totalPages: num('totalPages', 1) };
  }
  const get = <T>(path: string, token: string) => client.request<T>(path, { token });
  const send = <T>(path: string, token: string, body?: unknown, method: Options['method'] = 'POST') => client.request<T>(path, { method, token, body });

  return {
    listOrders: (token: string, params: { productId?: string; status?: ProductionOrderStatus; page?: number; limit?: number } = {}) =>
      page<ProductionOrder>(`${BASE}/orders${query({ productId: params.productId, status: params.status, page: params.page ?? 1, limit: params.limit ?? 50 })}`, token),
    getOrder: (token: string, id: string) => get<ProductionOrder>(`${BASE}/orders/${enc(id)}`, token),
    createOrder: (
      token: string,
      body: {
        code: string;
        productId: string;
        quantity: number;
        machine?: string;
        responsible?: string;
        dueDate?: string;
        notes?: string;
        materials?: Array<{ productId: string; quantityRequired: number }>;
      },
    ) => send<ProductionOrder>(`${BASE}/orders`, token, body),
    transitionOrder: (
      token: string,
      id: string,
      to: 'RELEASED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED',
      expectedVersion: number,
      extra?: { producedQuantity?: number; materials?: Array<{ productId: string; quantityConsumed: number }> },
    ) => send<ProductionOrder>(`${BASE}/orders/${enc(id)}/transition`, token, { to, expectedVersion, ...extra }),
    cancelOrder: (token: string, id: string) => send<ProductionOrder>(`${BASE}/orders/${enc(id)}`, token, undefined, 'DELETE'),
  };
}

export type ProductionApi = ReturnType<typeof createProductionApi>;

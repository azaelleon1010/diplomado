/**
 * Shared finance contract for the Web client.
 *
 * Mirrors apps/api/src/modules/finance. This is a cash register (accounts,
 * categories, posted/voided movements), not double-entry accounting — see
 * apps/api/src/modules/finance/domain/entities.ts. The API enforces every
 * rule (permissions, void instead of delete); the action helpers here only
 * decide which buttons to show.
 *
 * Mobile still has its own hand-written DTOs in apps/mobile/src/lib/api.ts
 * (financeApi); this module is the first shared contract for the module and
 * is meant to replace that duplication in a later, dedicated change — not
 * part of this one, to keep the diff reviewable.
 */
import type { InventoryRequestClient, InventoryRequestOptions } from './inventory';

export type FinanceRequestClient = InventoryRequestClient;
type Options = InventoryRequestOptions;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE';
export type AccountStatus = 'ACTIVE' | 'INACTIVE';

export interface Account {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  type: AccountType;
  description?: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const ACCOUNT_TYPE: Readonly<Record<AccountType, string>> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Capital',
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
};

export type FinanceCategoryKind = 'INCOME' | 'EXPENSE';

export interface FinanceCategory {
  _id: string;
  tenantId: string;
  name: string;
  kind: FinanceCategoryKind;
  description?: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type FinanceMovementKind = 'INCOME' | 'EXPENSE';
export type FinanceMovementStatus = 'POSTED' | 'VOIDED';
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD' | 'OTHER';

export interface FinanceMovement {
  _id: string;
  tenantId: string;
  accountId: string;
  categoryId?: string;
  kind: FinanceMovementKind;
  amount: number;
  method: PaymentMethod;
  concept: string;
  reference?: string;
  date: string;
  status: FinanceMovementStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface FinanceTotals {
  income: number;
  expenses: number;
  balance: number;
}

export const PAYMENT_METHOD: Readonly<Record<PaymentMethod, string>> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  OTHER: 'Otro',
};

export const MOVEMENT_STATUS: Readonly<Record<FinanceMovementStatus, { label: string; tone: Tone }>> = {
  POSTED: { label: 'Registrado', tone: 'success' },
  VOIDED: { label: 'Anulado', tone: 'neutral' },
};

export function formatMoney(value: number, currency = 'MXN'): string {
  try {
    return value.toLocaleString('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Spanish messages for finance business errors (API messages are technical English). */
export function describeFinanceError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  const text = typeof message === 'string' ? message : '';
  if (code === 'VERSION_CONFLICT') return 'Otro usuario modificó este registro. Recarga para ver la versión más reciente.';
  if (code === 'FORBIDDEN') return 'Tu rol no permite realizar esta acción.';
  if (code === 'CONFLICT' && text.toLowerCase().includes('movements')) return 'No se puede desactivar: tiene movimientos registrados.';
  if (code === 'CONFLICT' && text.toLowerCase().includes('code')) return 'Ese código ya existe.';
  if (code === 'CONFLICT' && text.toLowerCase().includes('voided')) return 'Este movimiento ya está anulado.';
  if (code === 'NOT_FOUND') return 'El registro no existe.';
  return null;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const BASE = '/api/v1/finance';

function query(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '' && value !== false)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

const enc = encodeURIComponent;

export function createFinanceApi(client: FinanceRequestClient) {
  async function page<T>(path: string, token: string): Promise<Page<T>> {
    const result = await client.page<T[]>(path, { token });
    const items = Array.isArray(result.data) ? result.data : [];
    const num = (k: string, d: number) => (typeof result.meta?.[k] === 'number' ? (result.meta[k] as number) : d);
    return { items, total: num('total', items.length), page: num('page', 1), limit: num('limit', items.length), totalPages: num('totalPages', 1) };
  }
  const get = <T>(path: string, token: string) => client.request<T>(path, { token });
  const send = <T>(path: string, token: string, body?: unknown, method: Options['method'] = 'POST') => client.request<T>(path, { method, token, body });

  return {
    // Accounts
    listAccounts: (token: string, params: { search?: string; type?: AccountType; status?: AccountStatus } = {}) =>
      page<Account>(`${BASE}/accounts${query({ ...params, page: 1, limit: 100 })}`, token),
    createAccount: (token: string, body: { code: string; name: string; type: AccountType; description?: string }) => send<Account>(`${BASE}/accounts`, token, body),
    updateAccount: (token: string, id: string, body: Record<string, unknown> & { expectedVersion: number }) => send<Account>(`${BASE}/accounts/${enc(id)}`, token, body, 'PATCH'),
    deactivateAccount: (token: string, id: string) => send<Account>(`${BASE}/accounts/${enc(id)}`, token, undefined, 'DELETE'),

    // Categories
    listCategories: (token: string, params: { kind?: FinanceCategoryKind; status?: AccountStatus } = {}) =>
      page<FinanceCategory>(`${BASE}/categories${query({ ...params, page: 1, limit: 100 })}`, token),
    createCategory: (token: string, body: { name: string; kind: FinanceCategoryKind; description?: string }) => send<FinanceCategory>(`${BASE}/categories`, token, body),
    updateCategory: (token: string, id: string, body: Record<string, unknown> & { expectedVersion: number }) => send<FinanceCategory>(`${BASE}/categories/${enc(id)}`, token, body, 'PATCH'),
    deactivateCategory: (token: string, id: string) => send<FinanceCategory>(`${BASE}/categories/${enc(id)}`, token, undefined, 'DELETE'),

    // Movements
    listMovements: (
      token: string,
      params: { accountId?: string; categoryId?: string; kind?: FinanceMovementKind; status?: FinanceMovementStatus; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {},
    ) => page<FinanceMovement>(`${BASE}/movements${query({ ...params, page: params.page ?? 1, limit: params.limit ?? 100 })}`, token),
    getMovement: (token: string, id: string) => get<FinanceMovement>(`${BASE}/movements/${enc(id)}`, token),
    createMovement: (token: string, body: { accountId: string; categoryId?: string; kind: FinanceMovementKind; amount: number; method: PaymentMethod; concept: string; reference?: string; date: string }) =>
      send<FinanceMovement>(`${BASE}/movements`, token, body),
    voidMovement: (token: string, id: string, expectedVersion: number) => send<FinanceMovement>(`${BASE}/movements/${enc(id)}/void`, token, { expectedVersion }),
    totals: (token: string, params: { accountId?: string; dateFrom?: string; dateTo?: string } = {}) => get<FinanceTotals>(`${BASE}/movements/totals${query(params)}`, token),
  };
}

export type FinanceApi = ReturnType<typeof createFinanceApi>;

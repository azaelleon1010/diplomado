/**
 * Minimal HTTP client for the TramaTech API (native fetch, no extra deps).
 * Base URL comes from VITE_API_URL, falling back to local dev.
 */
import {
  createInventoryApi,
  createStockApi,
  type InventoryCategory,
  type InventoryProduct,
  type InventoryRequestClient,
} from '../../../../packages/types/src/inventory';
import { createPurchasingApi } from '../../../../packages/types/src/purchasing';
import { createProductionApi } from '../../../../packages/types/src/production';
import { createMaintenanceApi } from '../../../../packages/types/src/maintenance';
import { createHrApi } from '../../../../packages/types/src/hr';
import { createFinanceApi } from '../../../../packages/types/src/finance';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
export const SESSION_EXPIRED_EVENT = 'tramatech:session-expired';

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    fields: Record<string, unknown>;
  };
  traceId: string;
}

export interface ApiSuccessEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
  traceId?: string;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.error.code;
    this.fields = body.error.fields ?? {};
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

export async function apiRequestWithMeta<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccessEnvelope<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok || !parsed || typeof parsed !== 'object' || (parsed as { success?: boolean }).success !== true) {
    const body: ApiErrorBody = (parsed as ApiErrorBody | null) ?? {
      success: false,
      error: { code: 'NETWORK_ERROR', message: `Request failed with status ${res.status}`, fields: {} },
      traceId: '',
    };
    const error = new ApiClientError(res.status, body.success === false ? body : {
      success: false,
      error: { code: 'NETWORK_ERROR', message: body && typeof body === 'object' ? 'Unexpected response' : `Request failed with status ${res.status}`, fields: {} },
      traceId: '',
    });
    if (res.status === 401 && !path.startsWith('/api/v1/auth/') && path !== '/api/v1/me') {
      try {
        clearSession();
      } catch {
        // Storage failures do not hide the original unauthorized response.
      }
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    throw error;
  }

  return parsed as ApiSuccessEnvelope<T>;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await apiRequestWithMeta<T>(path, options)).data;
}

export interface AuthUser {
  _id: string;
  tenantId: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: string;
}

export interface AuthTenant {
  tenantId: string;
  name: string;
  slug: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  tenantId: string;
  sessionId: string;
  user: AuthUser;
  permissions: string[];
  tenant?: AuthTenant;
}

export interface MeResponse {
  user: AuthUser;
  membership: { _id: string; tenantId: string; organizationId?: string; branchId?: string; status: string };
  roles: Array<{ _id: string; name: string; permissions: string[] }>;
  permissions: string[];
}

export interface RegisterInput {
  companyName: string;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export const authApi = {
  register: (input: RegisterInput) =>
    apiRequest<AuthTokens>('/api/v1/auth/register', { method: 'POST', body: input }),
  login: (email: string, password: string, tenantId: string) =>
    apiRequest<AuthTokens>('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password, tenantId },
    }),

  resolveTenant: (slug: string) =>
    apiRequest<AuthTenant>(`/api/v1/auth/tenant/${encodeURIComponent(slug)}`),
  refresh: (refreshToken: string) =>
    apiRequest<AuthTokens>('/api/v1/auth/refresh', { method: 'POST', body: { refreshToken } }),
  logout: (accessToken: string) =>
    apiRequest<{ loggedOut: boolean }>('/api/v1/auth/logout', { method: 'POST', token: accessToken }),
  me: (accessToken: string) =>
    apiRequest<MeResponse>('/api/v1/me', { token: accessToken }),

  /** Always resolves (never throws for "email not found") — the API never reveals whether the account exists. */
  forgotPassword: (email: string, tenantId?: string) =>
    apiRequest<{ requested: true }>('/api/v1/auth/forgot-password', { method: 'POST', body: { email, ...(tenantId ? { tenantId } : {}) } }),
  resetPassword: (resetId: string, token: string, newPassword: string) =>
    apiRequest<{ success: true }>('/api/v1/auth/reset-password', { method: 'POST', body: { resetId, token, newPassword } }),
};

const SESSION_KEY = 'tramatech.session.v1';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  sessionId: string;
}

export function loadSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      tenantId: parsed.tenantId ?? '',
      sessionId: parsed.sessionId ?? '',
    };
  } catch {
    return null;
  }
}

export function saveSession(session: StoredSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

export function friendlyMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return 'No se pudo conectar con el servidor. Intenta de nuevo.';
  return 'Ocurrió un error inesperado.';
}

export type Product = InventoryProduct;
export type Category = InventoryCategory;

const inventoryClient: InventoryRequestClient = {
  request: <T>(path: string, options: RequestOptions & { token: string }) => apiRequest<T>(path, options),
  page: <T>(path: string, options: RequestOptions & { token: string }) => apiRequestWithMeta<T>(path, options),
};

/** Shared inventory contract (packages/types/src/inventory.ts), same as Mobile. */
export const inventoryApi = createInventoryApi(inventoryClient);

/** Warehouses + stock ledger (packages/types/src/inventory.ts), same as the other client. */
export const stockApi = createStockApi(inventoryClient);

/** Shared purchasing contract (packages/types/src/purchasing.ts), same client Mobile uses. */
export const purchasingApi = createPurchasingApi(inventoryClient);

/** Shared production contract (packages/types/src/production.ts). */
export const productionApi = createProductionApi(inventoryClient);

/** Shared maintenance contract (packages/types/src/maintenance.ts). */
export const maintenanceApi = createMaintenanceApi(inventoryClient);

/** Shared HR contract (packages/types/src/hr.ts). */
export const hrApi = createHrApi(inventoryClient);

/** Shared finance contract (packages/types/src/finance.ts). */
export const financeApi = createFinanceApi(inventoryClient);

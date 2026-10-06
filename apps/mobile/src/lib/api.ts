import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifySessionExpired } from '../auth/sessionEvents';

const API_BASE = 'http://10.0.2.2:3000';

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    fields: Record<string, unknown>;
  };
  traceId: string;
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
  /**
   * Internal: marks a retried request so the refresh flow runs at most once.
   */
  _retried?: boolean;
}

export const SESSION_EXPIRED_CODE = 'SESSION_EXPIRED';

function sessionExpiredError(): ApiClientError {
  return new ApiClientError(401, {
    success: false,
    error: {
      code: SESSION_EXPIRED_CODE,
      message: 'Tu sesión expiró. Inicia sesión nuevamente.',
      fields: {},
    },
    traceId: '',
  });
}

/**
 * Serializes concurrent refresh attempts into a single
 * POST /api/v1/auth/refresh call.
 */
let refreshInFlight: Promise<AuthTokens> | null = null;

function refreshSession(refreshToken: string): Promise<AuthTokens> {
  if (!refreshInFlight) {
    refreshInFlight = doRequest<AuthTokens>('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    }).finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function doRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token
          ? { Authorization: `Bearer ${options.token}` }
          : {}),
      },
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch {
    throw new ApiClientError(0, {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message:
          'No se pudo conectar con el servidor. Verifica que la API esté ejecutándose.',
        fields: {},
      },
      traceId: '',
    });
  }

  let parsed: unknown = null;

  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (
    !res.ok ||
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as { success?: boolean }).success !== true
  ) {
    const body: ApiErrorBody = {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Request failed with status ${res.status}`,
        fields: {},
      },
      traceId: '',
    };

    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as { success?: boolean }).success === false
    ) {
      throw new ApiClientError(res.status, parsed as ApiErrorBody);
    }

    throw new ApiClientError(res.status, body);
  }

  return (parsed as { data: T }).data;
}

/**
 * Authenticated request with centralized access-token renewal.
 *
 * request → 401 → refresh once → retry original a single time.
 * Refresh failures clear the local session and notify the auth context,
 * returning the navigation tree to Login. Never loops: auth
 * endpoints and already-retried requests throw immediately.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  try {
    return await doRequest<T>(path, options);
  } catch (err) {
    if (
      !(err instanceof ApiClientError) ||
      err.status !== 401 ||
      options._retried ||
      path.startsWith('/api/v1/auth/')
    ) {
      throw err;
    }

    let stored: StoredSession | null = null;

    try {
      stored = await loadSession();
    } catch {
      stored = null;
    }

    if (!stored?.refreshToken) {
      await clearSession().catch(() => undefined);
      notifySessionExpired();
      throw sessionExpiredError();
    }

    let rotated: AuthTokens;

    try {
      rotated = await refreshSession(stored.refreshToken);
    } catch {
      await clearSession().catch(() => undefined);
      notifySessionExpired();
      throw sessionExpiredError();
    }

    await saveSession({
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
      tenantId: rotated.tenantId,
      sessionId: rotated.sessionId,
    }).catch(() => undefined);

    try {
      return await doRequest<T>(path, {
        ...options,
        token: rotated.accessToken,
        _retried: true,
      });
    } catch (retryError) {
      if (retryError instanceof ApiClientError && retryError.status === 401) {
        await clearSession().catch(() => undefined);
        notifySessionExpired();
        throw sessionExpiredError();
      }
      throw retryError;
    }
  }
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
  membership: {
    _id: string;
    tenantId: string;
    organizationId?: string;
    branchId?: string;
    status: string;
  };
  roles: Array<{
    _id: string;
    name: string;
    permissions: string[];
  }>;
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
    apiRequest<AuthTokens>('/api/v1/auth/register', {
      method: 'POST',
      body: input,
    }),

  login: (email: string, password: string) =>
    apiRequest<AuthTokens>('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email,
        password,
      },
    }),

  refresh: (refreshToken: string) =>
    apiRequest<AuthTokens>('/api/v1/auth/refresh', {
      method: 'POST',
      body: {
        refreshToken,
      },
    }),

  logout: (accessToken: string) =>
    apiRequest<{ loggedOut: boolean }>('/api/v1/auth/logout', {
      method: 'POST',
      token: accessToken,
    }),

  me: (accessToken: string) =>
    apiRequest<MeResponse>('/api/v1/me', {
      token: accessToken,
    }),
};

export interface Category {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Product {
  _id: string;
  tenantId: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  unit: string;
  barcode?: string;
  cost: number;
  price: number;
  minimumStock: number;
  maximumStock?: number;
  trackInventory: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  unit: string;
  barcode?: string;
  cost: number;
  price: number;
  minimumStock: number;
  maximumStock?: number;
  trackInventory: boolean;
}

export interface ListProductsParams {
  search?: string;
  categoryId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

function toQueryString(
  params: Record<string, string | number | undefined>,
): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      parts.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      );
    }
  }

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export const inventoryApi = {
  listCategories: (token: string) =>
    apiRequest<Category[]>('/api/v1/inventory/categories?limit=100', {
      token,
    }),

  listProducts: (token: string, params: ListProductsParams = {}) =>
    apiRequest<Product[]>(
      `/api/v1/inventory/products${toQueryString({
        search: params.search,
        categoryId: params.categoryId,
        status: params.status,
        page: params.page,
        limit: params.limit ?? 100,
      })}`,
      { token },
    ),

  createProduct: (token: string, input: CreateProductInput) =>
    apiRequest<Product>('/api/v1/inventory/products', {
      method: 'POST',
      token,
      body: input,
    }),
};

export interface Asset {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  type: string;
  location?: string;
  responsible?: string;
  status: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateAssetInput {
  code: string;
  name: string;
  type: string;
  location?: string;
  responsible?: string;
  purchaseDate?: string;
  warrantyUntil?: string;
  notes?: string;
}

export interface MaintenanceOrder {
  _id: string;
  tenantId: string;
  assetId: string;
  type: string;
  priority: string;
  title: string;
  description?: string;
  status: string;
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

export interface CreateOrderInput {
  assetId: string;
  type: 'PREVENTIVE' | 'CORRECTIVE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description?: string;
  scheduledFor?: string;
  cost?: number;
  assignedTo?: string;
  notes?: string;
}

export interface ListOrdersParams {
  assetId?: string;
  status?: string;
  priority?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export const maintenanceApi = {
  listAssets: (token: string) =>
    apiRequest<Asset[]>('/api/v1/maintenance/assets?limit=100', {
      token,
    }),

  createAsset: (token: string, input: CreateAssetInput) =>
    apiRequest<Asset>('/api/v1/maintenance/assets', {
      method: 'POST',
      token,
      body: input,
    }),

  retireAsset: (token: string, id: string) =>
    apiRequest<Asset>(`/api/v1/maintenance/assets/${id}`, {
      method: 'DELETE',
      token,
    }),

  listOrders: (token: string, params: ListOrdersParams = {}) =>
    apiRequest<MaintenanceOrder[]>(
      `/api/v1/maintenance/orders${toQueryString({
        assetId: params.assetId,
        status: params.status,
        priority: params.priority,
        type: params.type,
        page: params.page,
        limit: params.limit ?? 100,
      })}`,
      { token },
    ),

  getOrder: (token: string, id: string) =>
    apiRequest<MaintenanceOrder>(`/api/v1/maintenance/orders/${id}`, {
      token,
    }),

  createOrder: (token: string, input: CreateOrderInput) =>
    apiRequest<MaintenanceOrder>('/api/v1/maintenance/orders', {
      method: 'POST',
      token,
      body: input,
    }),

  transitionOrder: (
    token: string,
    id: string,
    to: 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED',
    expectedVersion: number,
    completedCost?: number,
  ) =>
    apiRequest<MaintenanceOrder>(
      `/api/v1/maintenance/orders/${id}/transition`,
      {
        method: 'POST',
        token,
        body:
          completedCost === undefined
            ? { to, expectedVersion }
            : { to, expectedVersion, completedCost },
      },
    ),

  cancelOrder: (token: string, id: string) =>
    apiRequest<MaintenanceOrder>(`/api/v1/maintenance/orders/${id}`, {
      method: 'DELETE',
      token,
    }),
};

export interface ProductionOrder {
  _id: string;
  tenantId: string;
  code: string;
  productId: string;
  quantity: number;
  producedQuantity: number;
  status: string;
  machine?: string;
  responsible?: string;
  dueDate?: string;
  notes?: string;
  startedAt?: string;
  completedAt?: string;
  materials: Array<{
    productId: string;
    quantityRequired: number;
    quantityConsumed: number;
  }>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateProductionOrderInput {
  code: string;
  productId: string;
  quantity: number;
  machine?: string;
  responsible?: string;
  dueDate?: string;
  notes?: string;
  materials: Array<{ productId: string; quantityRequired: number }>;
}

export interface ListProductionOrdersParams {
  productId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const productionApi = {
  listOrders: (token: string, params: ListProductionOrdersParams = {}) =>
    apiRequest<ProductionOrder[]>(
      `/api/v1/production/orders${toQueryString({
        productId: params.productId,
        status: params.status,
        page: params.page,
        limit: params.limit ?? 100,
      })}`,
      { token },
    ),

  getOrder: (token: string, id: string) =>
    apiRequest<ProductionOrder>(`/api/v1/production/orders/${id}`, {
      token,
    }),

  createOrder: (token: string, input: CreateProductionOrderInput) =>
    apiRequest<ProductionOrder>('/api/v1/production/orders', {
      method: 'POST',
      token,
      body: input,
    }),

  transitionOrder: (
    token: string,
    id: string,
    to: 'RELEASED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED',
    expectedVersion: number,
    extra?: { producedQuantity?: number },
  ) =>
    apiRequest<ProductionOrder>(
      `/api/v1/production/orders/${id}/transition`,
      {
        method: 'POST',
        token,
        body: { to, expectedVersion, ...(extra?.producedQuantity !== undefined ? { producedQuantity: extra.producedQuantity } : {}) },
      },
    ),

  cancelOrder: (token: string, id: string) =>
    apiRequest<ProductionOrder>(`/api/v1/production/orders/${id}`, {
      method: 'DELETE',
      token,
    }),
};

export interface Supplier {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateSupplierInput {
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

export interface PurchaseOrderLine {
  productId: string;
  quantity: number;
  unitCost: number;
  quantityReceived: number;
}

export interface PurchaseOrder {
  _id: string;
  tenantId: string;
  folio: string;
  supplierId: string;
  status: string;
  expectedDate?: string;
  notes?: string;
  receivedAt?: string;
  lines: PurchaseOrderLine[];
  subtotal: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreatePurchaseOrderInput {
  folio: string;
  supplierId: string;
  expectedDate?: string;
  notes?: string;
  lines: Array<{ productId: string; quantity: number; unitCost: number }>;
}

export interface ListPurchaseOrdersParams {
  supplierId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const purchasingApi = {
  listSuppliers: (token: string) =>
    apiRequest<Supplier[]>('/api/v1/purchasing/suppliers?limit=100', {
      token,
    }),

  createSupplier: (token: string, input: CreateSupplierInput) =>
    apiRequest<Supplier>('/api/v1/purchasing/suppliers', {
      method: 'POST',
      token,
      body: input,
    }),

  listOrders: (token: string, params: ListPurchaseOrdersParams = {}) =>
    apiRequest<PurchaseOrder[]>(
      `/api/v1/purchasing/orders${toQueryString({
        supplierId: params.supplierId,
        status: params.status,
        page: params.page,
        limit: params.limit ?? 100,
      })}`,
      { token },
    ),

  getOrder: (token: string, id: string) =>
    apiRequest<PurchaseOrder>(`/api/v1/purchasing/orders/${id}`, {
      token,
    }),

  createOrder: (token: string, input: CreatePurchaseOrderInput) =>
    apiRequest<PurchaseOrder>('/api/v1/purchasing/orders', {
      method: 'POST',
      token,
      body: input,
    }),

  transitionOrder: (
    token: string,
    id: string,
    to: 'SENT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED',
    expectedVersion: number,
    lines?: Array<{ productId: string; quantityReceived: number }>,
  ) =>
    apiRequest<PurchaseOrder>(
      `/api/v1/purchasing/orders/${id}/transition`,
      {
        method: 'POST',
        token,
        body: { to, expectedVersion, ...(lines !== undefined ? { lines } : {}) },
      },
    ),

  cancelOrder: (token: string, id: string) =>
    apiRequest<PurchaseOrder>(`/api/v1/purchasing/orders/${id}`, {
      method: 'DELETE',
      token,
    }),
};

export interface Department {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Employee {
  _id: string;
  tenantId: string;
  code: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  position?: string;
  location?: string;
  hireDate?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateEmployeeInput {
  code: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  departmentId?: string;
  position?: string;
  location?: string;
  hireDate?: string;
}

export interface TimeOff {
  _id: string;
  tenantId: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
  reason?: string;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateTimeOffInput {
  employeeId: string;
  type: 'VACATION' | 'SICK' | 'PERMISSION';
  startDate: string;
  endDate: string;
  reason?: string;
}

export const hrApi = {
  listDepartments: (token: string) =>
    apiRequest<Department[]>('/api/v1/hr/departments?limit=100', {
      token,
    }),

  listEmployees: (token: string, params: { search?: string; departmentId?: string; status?: string; limit?: number } = {}) =>
    apiRequest<Employee[]>(
      `/api/v1/hr/employees${toQueryString({
        search: params.search,
        departmentId: params.departmentId,
        status: params.status,
        limit: 100,
      })}`,
      { token },
    ),

  createEmployee: (token: string, input: CreateEmployeeInput) =>
    apiRequest<Employee>('/api/v1/hr/employees', {
      method: 'POST',
      token,
      body: input,
    }),

  updateEmployee: (token: string, id: string, input: Record<string, unknown>) =>
    apiRequest<Employee>(`/api/v1/hr/employees/${id}`, {
      method: 'PATCH',
      token,
      body: input,
    }),

  listTimeOff: (token: string, params: { employeeId?: string; status?: string; limit?: number } = {}) =>
    apiRequest<TimeOff[]>(
      `/api/v1/hr/time-off${toQueryString({
        employeeId: params.employeeId,
        status: params.status,
        limit: 100,
      })}`,
      { token },
    ),

  createTimeOff: (token: string, input: CreateTimeOffInput) =>
    apiRequest<TimeOff>('/api/v1/hr/time-off', {
      method: 'POST',
      token,
      body: input,
    }),

  decideTimeOff: (
    token: string,
    id: string,
    to: 'APPROVED' | 'REJECTED',
    expectedVersion: number,
  ) =>
    apiRequest<TimeOff>(`/api/v1/hr/time-off/${id}/decision`, {
      method: 'POST',
      token,
      body: { to, expectedVersion },
    }),
};

export interface Account {
  _id: string;
  tenantId: string;
  code: string;
  name: string;
  type: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface FinanceCategory {
  _id: string;
  tenantId: string;
  name: string;
  kind: string;
  description?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface FinanceMovement {
  _id: string;
  tenantId: string;
  accountId: string;
  categoryId?: string;
  kind: string;
  amount: number;
  method: string;
  concept: string;
  reference?: string;
  date: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateMovementInput {
  accountId: string;
  categoryId?: string;
  kind: 'INCOME' | 'EXPENSE';
  amount: number;
  method: 'CASH' | 'TRANSFER' | 'CARD' | 'OTHER';
  concept: string;
  reference?: string;
  date: string;
}

export interface FinanceTotals {
  income: number;
  expenses: number;
  balance: number;
}

export const financeApi = {
  listAccounts: (token: string) =>
    apiRequest<Account[]>('/api/v1/finance/accounts?limit=100', {
      token,
    }),

  listCategories: (token: string) =>
    apiRequest<FinanceCategory[]>('/api/v1/finance/categories?limit=100', {
      token,
    }),

  listMovements: (token: string, params: { accountId?: string; kind?: string; limit?: number } = {}) =>
    apiRequest<FinanceMovement[]>(
      `/api/v1/finance/movements${toQueryString({
        accountId: params.accountId,
        kind: params.kind,
        limit: params.limit ?? 100,
      })}`,
      { token },
    ),

  createMovement: (token: string, input: CreateMovementInput) =>
    apiRequest<FinanceMovement>('/api/v1/finance/movements', {
      method: 'POST',
      token,
      body: input,
    }),

  voidMovement: (token: string, id: string, expectedVersion: number) =>
    apiRequest<FinanceMovement>(`/api/v1/finance/movements/${id}/void`, {
      method: 'POST',
      token,
      body: { expectedVersion },
    }),

  totals: (token: string, params: { accountId?: string } = {}) =>
    apiRequest<FinanceTotals>(
      `/api/v1/finance/movements/totals${toQueryString({
        accountId: params.accountId,
      })}`,
      { token },
    ),
};

const SESSION_KEY = 'tramatech.session.v1';

export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  tenantId: string;
  sessionId: string;
}

export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredSession>;

    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }

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

export async function saveSession(
  session: StoredSession,
): Promise<void> {
  await AsyncStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session),
  );
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export function friendlyMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Ocurrió un error inesperado.';
}

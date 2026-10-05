import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: async (key: string) => (store.has(key) ? store.get(key) ?? null : null),
      setItem: async (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: async (key: string) => {
        store.delete(key);
      },
      __store: store,
    },
  };
});

import {
  apiRequest,
  clearSession,
  inventoryApi,
  loadSession,
  saveSession,
  SESSION_EXPIRED_CODE,
  ApiClientError,
} from './api';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const BEResp = (data: unknown) => ({
  success: true as const,
  data,
  traceId: 't1',
});

const BEError = (status: number, code: string, message: string) => ({
  status,
  body: { success: false, error: { code, message, fields: {} }, traceId: 't1' },
});

describe('mobile apiRequest', () => {
  beforeEach(async () => {
    await clearSession();
    vi.unstubAllGlobals();
  });

  it('returns the unwrapped data array for list endpoints (backend envelope)', async () => {
    const categories = [{ _id: 'c1', tenantId: 't', name: 'Cat', status: 'ACTIVE' }];
    const fetchMock = vi.fn(async () => jsonResponse(200, BEResp(categories)));
    vi.stubGlobal('fetch', fetchMock);

    const result = await inventoryApi.listCategories('access-1');

    expect(result).toEqual(categories);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once with a rotated token after 401 and persists the session', async () => {
    await saveSession({ accessToken: 'old-access', refreshToken: 'refresh-1', tenantId: 't', sessionId: 's' });
    const rotated = {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
      tenantId: 't',
      sessionId: 's2',
      user: { _id: 'u', tenantId: 't', username: 'u', email: 'u@x.mx', status: 'ACTIVE' },
      permissions: [],
    };
    const products = [{ _id: 'p1' }];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
      if (String(url).endsWith('/api/v1/auth/refresh')) {
        return jsonResponse(200, BEResp(rotated));
      }
      if (auth === 'Bearer old-access') {
        const e = BEError(401, 'UNAUTHORIZED', 'Invalid or expired token');
        return jsonResponse(e.status, e.body);
      }
      return jsonResponse(200, BEResp(products));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiRequest<unknown[]>('/api/v1/inventory/products', { token: 'old-access' });

    expect(result).toEqual(products);
    const stored = await loadSession();
    expect(stored?.accessToken).toBe('new-access');
    expect(stored?.refreshToken).toBe('new-refresh');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('clears the session and surfaces SESSION_EXPIRED when refresh fails', async () => {
    await saveSession({ accessToken: 'old-access', refreshToken: 'bad-refresh', tenantId: 't', sessionId: 's' });
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith('/api/v1/auth/refresh')) {
        const e = BEError(401, 'UNAUTHORIZED', 'Invalid or expired refresh token');
        return jsonResponse(e.status, e.body);
      }
      const e = BEError(401, 'UNAUTHORIZED', 'Invalid or expired token');
      return jsonResponse(e.status, e.body);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest('/api/v1/inventory/products', { token: 'old-access' }),
    ).rejects.toMatchObject({ code: SESSION_EXPIRED_CODE, status: 401 });

    expect(await loadSession()).toBeNull();
  });

  it('does not attempt refresh for auth endpoints', async () => {
    const fetchMock = vi.fn(async () => {
      const e = BEError(401, 'UNAUTHORIZED', 'Invalid email or password');
      return jsonResponse(e.status, e.body);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      apiRequest('/api/v1/auth/login', { method: 'POST', body: {} }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('createProduct sends numbers as numbers through the real contract', async () => {
    let seenBody: unknown = null;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      seenBody = JSON.parse(String(init?.body));
      return jsonResponse(201, BEResp({ _id: 'p9' }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await inventoryApi.createProduct('tok', {
      sku: 'PROD-TEST-001',
      name: 'Producto de prueba',
      description: 'Producto creado durante QA',
      unit: 'pieza',
      cost: 100,
      price: 150,
      minimumStock: 5,
      maximumStock: 100,
      trackInventory: true,
    });

    const body = seenBody as Record<string, unknown>;
    expect(typeof body.cost).toBe('number');
    expect(typeof body.price).toBe('number');
    expect(typeof body.minimumStock).toBe('number');
    expect(typeof body.maximumStock).toBe('number');
    expect(body).toMatchObject({ sku: 'PROD-TEST-001', unit: 'pieza' });
  });

  it('ApiClientError is an Error instance (friendlyMessage compatible)', () => {
    const err = new ApiClientError(400, {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed', fields: {} },
      traceId: '',
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Validation failed');
  });
});

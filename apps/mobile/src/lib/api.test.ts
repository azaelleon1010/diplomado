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
  API_BASE_URL,
  apiRequest,
  clearSession,
  friendlyMessage,
  inventoryApi,
  loadSession,
  loginWithCompany,
  saveSession,
  sessionFromTokens,
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

  it('logs in like the Web: resolves the company slug, then sends its tenantId', async () => {
    const tenant = { tenantId: 'tnt_abc', name: 'Textiles MX', slug: 'textiles-mx' };
    const tokens = {
      accessToken: 'a1',
      refreshToken: 'r1',
      tokenType: 'Bearer',
      expiresIn: 900,
      tenantId: 'tnt_abc',
      sessionId: 's1',
      user: { _id: 'u', tenantId: 'tnt_abc', username: 'u', email: 'u@x.mx', status: 'ACTIVE' },
      permissions: ['inventory.read'],
    };
    const calls: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return jsonResponse(200, BEResp(String(url).includes('/auth/tenant/') ? tenant : tokens));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await loginWithCompany('  textiles-mx ', ' u@x.mx ', 'Password123');

    expect(calls).toEqual([
      { url: `${API_BASE_URL}/api/v1/auth/tenant/textiles-mx`, method: 'GET', body: undefined },
      {
        url: `${API_BASE_URL}/api/v1/auth/login`,
        method: 'POST',
        body: { email: 'u@x.mx', password: 'Password123', tenantId: 'tnt_abc' },
      },
    ]);
    expect(result.tenant).toEqual(tenant);
    expect(sessionFromTokens(result.tokens, result.tenant)).toEqual({
      accessToken: 'a1',
      refreshToken: 'r1',
      tenantId: 'tnt_abc',
      sessionId: 's1',
      tenant,
    });
  });

  it('stops before login when the company does not exist', async () => {
    const fetchMock = vi.fn(async () => {
      const e = BEError(404, 'TENANT_NOT_FOUND', 'Empresa no encontrada');
      return jsonResponse(e.status, e.body);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(loginWithCompany('no-existe', 'u@x.mx', 'x')).rejects.toMatchObject({
      code: 'TENANT_NOT_FOUND',
      message: 'Empresa no encontrada',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps company metadata only for the token tenant, also after a refresh', async () => {
    const tenant = { tenantId: 't', name: 'Textiles MX', slug: 'textiles-mx' };
    expect(sessionFromTokens({ accessToken: 'a', refreshToken: 'r', tenantId: 'other', sessionId: 's' }, tenant).tenant).toBeUndefined();

    await saveSession({ accessToken: 'old-access', refreshToken: 'refresh-1', tenantId: 't', sessionId: 's', tenant });
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization ?? '';
      if (String(url).endsWith('/api/v1/auth/refresh')) {
        return jsonResponse(200, BEResp({ accessToken: 'new-access', refreshToken: 'new-refresh', tokenType: 'Bearer', expiresIn: 900, tenantId: 't', sessionId: 's2' }));
      }
      if (auth === 'Bearer old-access') {
        const e = BEError(401, 'UNAUTHORIZED', 'Invalid or expired token');
        return jsonResponse(e.status, e.body);
      }
      return jsonResponse(200, BEResp([]));
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('/api/v1/inventory/products', { token: 'old-access' });

    expect(await loadSession()).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      tenantId: 't',
      sessionId: 's2',
      tenant,
    });
  });

  it('updates products with PATCH + expectedVersion and deactivates with DELETE', async () => {
    const seen: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      seen.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return jsonResponse(200, BEResp({ _id: 'p1', version: 3 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await inventoryApi.updateProduct('tok', 'p1', {
      sku: 'A-1',
      name: 'Tela',
      description: null,
      categoryId: null,
      unit: 'PZA',
      barcode: null,
      cost: 1,
      price: 2,
      minimumStock: 0,
      maximumStock: null,
      trackInventory: true,
      expectedVersion: 2,
    });
    await inventoryApi.deactivateProduct('tok', 'p1');
    await inventoryApi.activateProduct('tok', 'p1', 3);

    expect(seen.map((c) => `${c.method} ${c.url.replace(API_BASE_URL, '')}`)).toEqual([
      'PATCH /api/v1/inventory/products/p1',
      'DELETE /api/v1/inventory/products/p1',
      'PATCH /api/v1/inventory/products/p1',
    ]);
    expect(seen[0]?.body).toMatchObject({ expectedVersion: 2, description: null });
    expect(seen[2]?.body).toEqual({ status: 'ACTIVE', expectedVersion: 3 });
  });

  it('explains a missing route as an outdated API deployment', () => {
    const missingRoute = new ApiClientError(404, {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route POST /api/v1/auth/login not found', fields: {} },
      traceId: '',
    });
    const missingCompany = new ApiClientError(404, {
      success: false,
      error: { code: 'TENANT_NOT_FOUND', message: 'Empresa no encontrada', fields: {} },
      traceId: '',
    });

    expect(friendlyMessage(missingRoute)).toContain('backend desplegado');
    expect(friendlyMessage(missingCompany)).toBe('Empresa no encontrada');
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

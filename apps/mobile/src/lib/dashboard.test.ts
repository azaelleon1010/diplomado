import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

import { ApiClientError } from './api';
import {
  dashboardApi,
  dashboardAreaIsEmpty,
  dashboardAreaStateForMetrics,
  dashboardAreaStateForError,
  DashboardUnavailableError,
  getVisibleDashboardAreas,
} from './dashboard';

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

describe('mobile dashboard data', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('only exposes areas granted by the backend permission catalog', () => {
    expect(getVisibleDashboardAreas(['maintenance.read'])).toEqual(['maintenance', 'system']);
    expect(getVisibleDashboardAreas(['hr.read.self'])).toContain('hr');
    expect(getVisibleDashboardAreas(['*'])).toContain('finance');
    expect(getVisibleDashboardAreas([])).not.toContain('finance');
  });

  it('uses actual page totals and filters for purchasing stage metrics', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => jsonResponse({ success: true, data: [{}], meta: { page: 1, limit: 1, total: 6, totalPages: 6 }, traceId: 't' }));
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await dashboardApi.purchasing('token');

    expect(metrics[0]).toMatchObject({ label: 'Órdenes aprobadas', value: '6', count: 6 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/purchasing/orders?status=APPROVED&page=1&limit=1');
  });

  it('counts critical maintenance orders only within the open status', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => jsonResponse({ success: true, data: [{}], meta: { page: 1, limit: 1, total: 3, totalPages: 3 }, traceId: 't' }));
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await dashboardApi.maintenance('token');

    expect(metrics[1]).toMatchObject({ label: 'Críticas abiertas', value: '3', count: 3, accent: 'danger' });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('status=OPEN&priority=CRITICAL&page=1&limit=1');
  });

  it('marks a list endpoint unavailable when pagination totals are absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async (..._args: unknown[]) => jsonResponse({ success: true, data: [], traceId: 't' })));
    await expect(dashboardApi.production('token')).rejects.toBeInstanceOf(DashboardUnavailableError);
  });

  it('uses the personal time-off scope when the user has only hr.read.self', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => jsonResponse({ success: true, data: [{}], meta: { page: 1, limit: 1, total: 2, totalPages: 2 }, traceId: 't' }));
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await dashboardApi.hr('token', ['hr.read.self']);

    expect(metrics).toEqual([expect.objectContaining({ label: 'Mis solicitudes pendientes', count: 2 })]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/hr/time-off?status=PENDING&page=1&limit=1');
  });

  it('handles empty, forbidden, unavailable and failed sections separately', () => {
    expect(dashboardAreaIsEmpty([{ id: 'm', label: 'Movimientos', value: '0', subtitle: 'POSTED', accent: 'info', count: 0 }])).toBe(true);
    expect(dashboardAreaStateForMetrics([{ id: 'm', label: 'Movimientos', value: '0', subtitle: 'POSTED', accent: 'info', count: 0 }])).toBe('empty');
    expect(dashboardAreaStateForMetrics([{ id: 'm', label: 'Movimientos', value: '1', subtitle: 'POSTED', accent: 'info', count: 1 }])).toBe('ready');
    const denied = new ApiClientError(403, { success: false, error: { code: 'FORBIDDEN', message: 'Denied', fields: {} }, traceId: 't' });
    expect(dashboardAreaStateForError(denied)).toBe('forbidden');
    expect(dashboardAreaStateForError(new DashboardUnavailableError())).toBe('unavailable');
    expect(dashboardAreaStateForError(new Error('Network failure'))).toBe('error');
  });
});

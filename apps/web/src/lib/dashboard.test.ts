import { describe, expect, it, vi, afterEach } from 'vitest';
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

describe('web dashboard data', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('only exposes areas granted by the backend permission catalog', () => {
    expect(getVisibleDashboardAreas(['production.read'])).toEqual(['production', 'system']);
    expect(getVisibleDashboardAreas(['hr.read.self'])).toContain('hr');
    expect(getVisibleDashboardAreas(['*'])).toContain('finance');
    expect(getVisibleDashboardAreas([])).not.toContain('finance');
  });

  it('turns server pagination metadata into the production count', async () => {
    const fetchMock = vi.fn(async (..._args: unknown[]) => jsonResponse({ success: true, data: [{}], meta: { page: 1, limit: 1, total: 27, totalPages: 27 }, traceId: 't' }));
    vi.stubGlobal('fetch', fetchMock);

    const metrics = await dashboardApi.production('token');

    expect(metrics[0]).toMatchObject({ label: 'En proceso', value: '27', count: 27 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/v1/production/orders?status=IN_PROGRESS&page=1&limit=1');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ headers: { Authorization: 'Bearer token' } });
  });

  it('marks a list endpoint unavailable when pagination totals are absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async (..._args: unknown[]) => jsonResponse({ success: true, data: [], traceId: 't' })));
    await expect(dashboardApi.production('token')).rejects.toBeInstanceOf(DashboardUnavailableError);
  });

  it('treats zero counts as empty while retaining non-count status data', () => {
    expect(dashboardAreaIsEmpty([{ id: 'p', label: 'Productos', value: '0', subtitle: 'Catálogo', accent: 'info', count: 0 }])).toBe(true);
    expect(dashboardAreaStateForMetrics([{ id: 'p', label: 'Productos', value: '0', subtitle: 'Catálogo', accent: 'info', count: 0 }])).toBe('empty');
    expect(dashboardAreaStateForMetrics([{ id: 'p', label: 'Productos', value: '4', subtitle: 'Catálogo', accent: 'info', count: 4 }])).toBe('ready');
    expect(dashboardAreaIsEmpty([{ id: 'api', label: 'API', value: 'Operativa', subtitle: 'Liveness', accent: 'success' }])).toBe(false);
  });

  it('distinguishes forbidden, unavailable, and ordinary failures', () => {
    const error = (status: number, code: string, message: string) => new ApiClientError(status, {
      success: false,
      error: { code, message, fields: {} },
      traceId: 't',
    });
    expect(dashboardAreaStateForError(error(403, 'FORBIDDEN', 'Denied'))).toBe('forbidden');
    expect(dashboardAreaStateForError(error(404, 'NOT_FOUND', 'Route GET /api/v1/missing not found'))).toBe('unavailable');
    expect(dashboardAreaStateForError(error(404, 'NOT_FOUND', 'Employee not found'))).toBe('error');
    expect(dashboardAreaStateForError(new DashboardUnavailableError())).toBe('unavailable');
    expect(dashboardAreaStateForError(new Error('Network failure'))).toBe('error');
  });
});

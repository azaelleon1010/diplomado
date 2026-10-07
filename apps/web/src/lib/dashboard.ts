import { createDashboardApi, type DashboardRequestClient } from '../../../../packages/types/src/dashboard';
import { apiRequest, apiRequestWithMeta } from './api';

export * from '../../../../packages/types/src/dashboard';

const client: DashboardRequestClient = {
  request: <T>(path: string, token: string) => apiRequest<T>(path, { token }),
  page: <T>(path: string, token: string) => apiRequestWithMeta<T>(path, { token }),
};

export const dashboardApi = createDashboardApi(client);

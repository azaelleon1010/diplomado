export type TenantId = string;
export type OrganizationId = string;
export type BranchId = string;

export interface BaseDocument {
  _id: string;
  tenantId: TenantId;
  organizationId?: OrganizationId;
  branchId?: BranchId;
  legalEntityId?: string;
  locationId?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginatedMeta | Record<string, unknown>;
  traceId: string;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string; fields?: Record<string, unknown> };
  traceId: string;
}

export type TraceContext = {
  traceId: string;
  requestId: string;
  tenantId?: string;
  userId?: string;
};

export type HealthStatus = 'ok' | 'degraded' | 'down';
export interface DependencyHealth { status: HealthStatus; latencyMs?: number; message?: string; }
export interface HealthResponse {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  dependencies: Record<string, DependencyHealth>;
}

export type TenantStatus = 'ACTIVE' | 'DISABLED';

export interface Tenant {
  _id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

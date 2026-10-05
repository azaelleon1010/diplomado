import type { Tenant, TenantStatus } from './entities';

/**
 * Opaque transaction handle. Domain never touches the driver:
 * infrastructure casts it to the driver's session type.
 */
export type TxSession = unknown;

export interface ITenantStore {
  findById(tenantId: string): Promise<Tenant | null>;
  findBySlug(slug: string, session?: TxSession): Promise<Tenant | null>;
  create(data: {
    tenantId: string;
    name: string;
    slug: string;
    createdBy: string;
  }, session?: TxSession): Promise<Tenant>;
  setStatus(
    tenantId: string,
    status: TenantStatus,
    updatedBy: string,
  ): Promise<Tenant | null>;
}

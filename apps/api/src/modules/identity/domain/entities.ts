/**
 * Identity domain entities — pure TypeScript.
 * No Express, no Mongoose, no JWT, no bcrypt allowed in this layer.
 */

export type UserStatus = 'ACTIVE' | 'DISABLED';
export type MembershipStatus = 'ACTIVE' | 'DISABLED';
export type RoleStatus = 'ACTIVE' | 'DISABLED';

export interface User {
  _id: string;
  /** Home tenant of the identity. Data access always goes through Membership. */
  tenantId: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

/** Credentials are kept separate so passwordHash can never leak via User. */
export interface UserCredentials {
  userId: string;
  passwordHash: string;
}

export type UserWithCredentials = User & { passwordHash: string };

export interface Role {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  permissions: string[];
  status: RoleStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface Membership {
  _id: string;
  tenantId: string;
  organizationId?: string;
  branchId?: string;
  userId: string;
  roleIds: string[];
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface RefreshSession {
  _id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  /** SHA-256 hex of the refresh token. Plaintext is never persisted. */
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export type AuditResult = 'SUCCESS' | 'FAILURE';

export interface AuditEvent {
  _id?: string;
  tenantId: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  result: AuditResult;
  correlationId?: string;
  createdAt?: Date;
}

export const AUTH_ACTIONS = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  REGISTER_SUCCESS: 'auth.register.success',
  REFRESH: 'auth.refresh',
  LOGOUT: 'auth.logout',
  TENANT_CREATED: 'tenants.created',
  USER_CREATED: 'users.created',
  ROLE_ASSIGNED: 'memberships.roleAssigned',
  ROLE_PERMISSIONS_SYNCED: 'roles.permissionsSynced',
} as const;

/** Keys that must never be persisted into audit before/after payloads. */
const SECRET_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'refreshtoken',
  'refresh_token',
  'accesstoken',
  'access_token',
  'jwt_secret',
  'secret',
  'authorization',
]);

/** Remove secrets (shallow + one nested level for data envelopes). */
export function sanitizeForAudit(value: unknown): Record<string, unknown> | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.has(k.toLowerCase())) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const nested: Record<string, unknown> = {};
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        if (!SECRET_KEYS.has(nk.toLowerCase())) nested[nk] = nv;
      }
      out[k] = nested;
    } else {
      out[k] = v;
    }
  }
  return out;
}

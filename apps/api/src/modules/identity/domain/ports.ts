/**
 * Identity ports — abstractions owned by the Domain.
 * Infrastructure provides the implementations.
 */
import type {
  AuditEvent,
  Membership,
  PasswordResetToken,
  RefreshSession,
  Role,
  User,
  UserWithCredentials,
} from './entities';

export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  verify(plain: string, hash: string): Promise<boolean>;
}

export interface AccessClaims {
  sub: string;
  tenantId: string;
  sessionId: string;
  type: 'access';
}

export interface RefreshClaims {
  sub: string;
  tenantId: string;
  sessionId: string;
  type: 'refresh';
}

export interface IssuedRefresh {
  token: string;
  expiresAt: Date;
}

export interface ITokenIssuer {
  issueAccess(input: { userId: string; tenantId: string; sessionId: string }): string;
  issueRefresh(input: { userId: string; tenantId: string; sessionId: string }): IssuedRefresh;
  verifyAccess(token: string): AccessClaims;
  verifyRefresh(token: string): RefreshClaims;
  /** SHA-256 hex used for refresh-session storage (never plaintext). */
  hashToken(token: string): string;
  accessTtlSeconds(): number;
}

export interface CreateUserData {
  tenantId: string;
  username: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  createdBy: string;
}

/** Opaque transaction handle (see tenant/domain/ports.ts TxSession). */
export type TxSession = unknown;

export interface IUserStore {
  findById(tenantId: string, id: string, session?: TxSession): Promise<UserWithCredentials | null>;
  /** Minimal current status lookup used to invalidate already-issued access tokens. */
  findStatusById(tenantId: string, id: string): Promise<User['status'] | null>;
  findByEmail(tenantId: string, email: string, session?: TxSession): Promise<UserWithCredentials | null>;
  /** Identity resolution only (login): searches across tenants, never for data access. */
  findByEmailAnyTenant(email: string): Promise<UserWithCredentials[]>;
  create(data: CreateUserData, session?: TxSession): Promise<UserWithCredentials>;
  setStatus(tenantId: string, id: string, status: User['status'], updatedBy: string): Promise<UserWithCredentials | null>;
  /** Password reset only sets the hash; it never touches status or other fields. */
  setPasswordHash(tenantId: string, id: string, passwordHash: string, updatedBy: string): Promise<UserWithCredentials | null>;
  list(tenantId: string, page: number, limit: number): Promise<{ data: User[]; total: number; page: number; limit: number; totalPages: number }>;
}

export interface CreatePasswordResetTokenData {
  tenantId: string;
  userId: string;
  resetId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface IPasswordResetStore {
  create(data: CreatePasswordResetTokenData): Promise<PasswordResetToken>;
  /** resetId is the public identifier embedded in the link (lookup is global by design, like refresh sessionId). */
  findByResetId(resetId: string): Promise<PasswordResetToken | null>;
  markUsed(resetId: string): Promise<void>;
}

export interface IRoleStore {
  findById(tenantId: string, id: string): Promise<Role | null>;
  findByIds(tenantId: string, ids: string[]): Promise<Role[]>;
  findByName(tenantId: string, name: string): Promise<Role | null>;
  create(data: { tenantId: string; name: string; description?: string; permissions: string[]; createdBy: string }, session?: TxSession): Promise<Role>;
  list(tenantId: string): Promise<Role[]>;
  setPermissions(tenantId: string, roleId: string, permissions: string[], updatedBy: string): Promise<Role | null>;
}

/**
 * Cross-tenant role access for platform maintenance scripts only (never
 * wired to HTTP routes). Kept separate from IRoleStore on purpose.
 */
export interface ISystemRoleStore {
  findActiveByNameAcrossTenants(names: string[]): Promise<Role[]>;
  setPermissions(tenantId: string, roleId: string, permissions: string[], updatedBy: string): Promise<Role | null>;
}

export interface IMembershipStore {
  findByUserAndTenant(userId: string, tenantId: string): Promise<Membership | null>;
  findActiveByUser(userId: string): Promise<Membership[]>;
  create(data: { tenantId: string; organizationId?: string; branchId?: string; userId: string; roleIds: string[]; createdBy: string }, session?: TxSession): Promise<Membership>;
  setRoles(tenantId: string, membershipId: string, roleIds: string[], updatedBy: string): Promise<Membership | null>;
}

export interface ISessionStore {
  create(data: { tenantId: string; userId: string; sessionId: string; tokenHash: string; expiresAt: Date }, session?: TxSession): Promise<RefreshSession>;
  findBySessionId(sessionId: string): Promise<RefreshSession | null>;
  revoke(sessionId: string): Promise<void>;
  revokeAllForUser(tenantId: string, userId: string): Promise<void>;
}

export interface IAuditSink {
  record(event: Omit<AuditEvent, '_id' | 'createdAt'>, session?: TxSession): Promise<void>;
}

/** Request-scoped identity context built by authenticate middleware. */
export interface RequestIdentity {
  userId: string;
  tenantId: string;
  sessionId: string;
}

/** Injectable transaction runner (defaults to withTransaction in the use case). */
export type TxRunner = <T>(fn: (session: TxSession) => Promise<T>) => Promise<T>;

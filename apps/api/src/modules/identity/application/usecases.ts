/**
 * Identity use cases — orchestrate ports, enforce business rules.
 * No Express, no Mongoose here.
 */
import { AppError, forbidden, unauthorized } from '@erp/errors';
import { withTransaction } from '@erp/database';
import { randomBytes, randomUUID } from 'node:crypto';
import { AUTH_ACTIONS, sanitizeForAudit, type AuditResult, type User } from '../domain/entities';
import { ALL_PERMISSIONS, resolvePermissions } from '../domain/permissions';
import type { ITenantStore } from '../../tenant/domain/ports';
import type { IEmailProvider } from '../../notifications/domain/ports';
import type {
  IAuditSink,
  IMembershipStore,
  IPasswordHasher,
  IRoleStore,
  ISessionStore,
  ITokenIssuer,
  IUserStore,
  TxRunner,
  TxSession,
} from '../domain/ports';

export interface IdentityDeps {
  tenants: ITenantStore;
  users: IUserStore;
  roles: IRoleStore;
  memberships: IMembershipStore;
  sessions: ISessionStore;
  audit: IAuditSink;
  hasher: IPasswordHasher;
  tokens: ITokenIssuer;
}

/** Extended deps for registration (needs the tenant store). */
export interface RegisterDeps extends IdentityDeps {
  emailProvider: IEmailProvider;
  /** Defaults to withTransaction; injectable for unit tests. */
  tx?: TxRunner;
}

export interface ActorContext {
  userId: string;
  tenantId: string;
  sessionId?: string;
  correlationId?: string;
}

/** Generic message — never reveals whether the user exists. */
const INVALID_CREDENTIALS = 'Invalid email or password';

export function toSafeUser(user: { _id: string; tenantId: string; username: string; email: string; firstName?: string; lastName?: string; status: User['status']; createdAt: Date; updatedAt: Date; version: number }) {
  return {
    _id: user._id,
    tenantId: user.tenantId,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    version: user.version,
  };
}

async function audit(deps: IdentityDeps, event: { tenantId: string; userId?: string; action: string; entityType?: string; entityId?: string; before?: unknown; after?: unknown; result: AuditResult; correlationId?: string }) {
  await deps.audit.record({
    tenantId: event.tenantId,
    userId: event.userId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    before: sanitizeForAudit(event.before),
    after: sanitizeForAudit(event.after),
    result: event.result,
    correlationId: event.correlationId,
  });
}

export interface LoginInput {
  email: string;
  password: string;
  tenantId?: string;
  correlationId?: string;
}

export async function login(input: LoginInput, deps: IdentityDeps) {
  const email = input.email.trim().toLowerCase();
  const auditTenant = (input.tenantId ?? '').trim() || 'UNRESOLVED';
  const fail = async () => {
    await audit(deps, { tenantId: auditTenant, action: AUTH_ACTIONS.LOGIN_FAILURE, entityType: 'user', result: 'FAILURE', correlationId: input.correlationId, after: { email } });
    throw unauthorized(INVALID_CREDENTIALS);
  };

  const candidates = await deps.users.findByEmailAnyTenant(email);
  if (candidates.length === 0) return fail();

  let candidate = candidates[0];
  if (input.tenantId) {
    const inTenant = candidates.find((c) => c.tenantId === input.tenantId);
    if (!inTenant) return fail();
    candidate = inTenant;
  } else if (candidates.length > 1) {
    // Ambiguous identity across tenants — require explicit tenant, reveal nothing.
    return fail();
  }
  if (!candidate) return fail();

  if (candidate.status !== 'ACTIVE') return fail();
  const membership = await deps.memberships.findByUserAndTenant(candidate._id, candidate.tenantId);
  if (!membership || membership.status !== 'ACTIVE') return fail();
  const ok = await deps.hasher.verify(input.password, candidate.passwordHash);
  if (!ok) return fail();

  const tenant = await deps.tenants.findById(candidate.tenantId);
  if (!tenant || tenant.status !== 'ACTIVE') return fail();

  const sessionId = randomUUID();
  const issued = deps.tokens.issueRefresh({ userId: candidate._id, tenantId: candidate.tenantId, sessionId });
  await deps.sessions.create({
    tenantId: candidate.tenantId,
    userId: candidate._id,
    sessionId,
    tokenHash: deps.tokens.hashToken(issued.token),
    expiresAt: issued.expiresAt,
  });
  const accessToken = deps.tokens.issueAccess({ userId: candidate._id, tenantId: candidate.tenantId, sessionId });
  const roles = await deps.roles.findByIds(candidate.tenantId, membership.roleIds);
  const permissions = resolvePermissions(roles.filter((r) => r.status === 'ACTIVE'));

  await audit(deps, {
    tenantId: candidate.tenantId,
    userId: candidate._id,
    action: AUTH_ACTIONS.LOGIN_SUCCESS,
    entityType: 'user',
    entityId: candidate._id,
    result: 'SUCCESS',
    correlationId: input.correlationId,
    after: { email: candidate.email, sessionId },
  });

  return {
    accessToken,
    refreshToken: issued.token,
    tokenType: 'Bearer' as const,
    expiresIn: deps.tokens.accessTtlSeconds(),
    tenantId: candidate.tenantId,
    sessionId,
    user: toSafeUser(candidate),
    permissions,
  };
}

export interface RefreshInput {
  refreshToken: string;
  correlationId?: string;
}

export async function refresh(input: RefreshInput, deps: IdentityDeps) {
  let claims;
  try {
    claims = deps.tokens.verifyRefresh(input.refreshToken);
  } catch {
    throw unauthorized('Invalid or expired refresh token');
  }
  const session = await deps.sessions.findBySessionId(claims.sessionId);
  const tokenHash = deps.tokens.hashToken(input.refreshToken);
  const usable =
    session !== null &&
    session.revokedAt == null &&
    session.expiresAt.getTime() > Date.now() &&
    session.tokenHash === tokenHash &&
    session.userId === claims.sub &&
    session.tenantId === claims.tenantId;
  if (!usable) {
    await audit(deps, { tenantId: claims.tenantId, userId: claims.sub, action: AUTH_ACTIONS.REFRESH, entityType: 'refreshSession', entityId: claims.sessionId, result: 'FAILURE', correlationId: input.correlationId });
    throw unauthorized('Invalid or expired refresh token');
  }

  const [userStatus, tenant] = await Promise.all([
    deps.users.findStatusById(claims.tenantId, claims.sub),
    deps.tenants.findById(claims.tenantId),
  ]);
  if (userStatus !== 'ACTIVE' || !tenant || tenant.status !== 'ACTIVE') {
    await audit(deps, { tenantId: claims.tenantId, userId: claims.sub, action: AUTH_ACTIONS.REFRESH, entityType: 'refreshSession', entityId: claims.sessionId, result: 'FAILURE', correlationId: input.correlationId });
    throw unauthorized('Invalid or expired refresh token');
  }

  // Rotation: revoke the presented session, issue a fresh pair.
  await deps.sessions.revoke(claims.sessionId);
  const sessionId = randomUUID();
  const issued = deps.tokens.issueRefresh({ userId: claims.sub, tenantId: claims.tenantId, sessionId });
  await deps.sessions.create({
    tenantId: claims.tenantId,
    userId: claims.sub,
    sessionId,
    tokenHash: deps.tokens.hashToken(issued.token),
    expiresAt: issued.expiresAt,
  });
  const accessToken = deps.tokens.issueAccess({ userId: claims.sub, tenantId: claims.tenantId, sessionId });

  await audit(deps, { tenantId: claims.tenantId, userId: claims.sub, action: AUTH_ACTIONS.REFRESH, entityType: 'refreshSession', entityId: sessionId, result: 'SUCCESS', correlationId: input.correlationId, after: { sessionId, rotatedFrom: claims.sessionId } });

  return { accessToken, refreshToken: issued.token, tokenType: 'Bearer' as const, expiresIn: deps.tokens.accessTtlSeconds(), tenantId: claims.tenantId, sessionId };
}

export async function logout(ctx: ActorContext, deps: IdentityDeps) {
  if (!ctx.sessionId) throw unauthorized('Session context is missing');
  await deps.sessions.revoke(ctx.sessionId);
  await audit(deps, { tenantId: ctx.tenantId, userId: ctx.userId, action: AUTH_ACTIONS.LOGOUT, entityType: 'refreshSession', entityId: ctx.sessionId, result: 'SUCCESS', correlationId: ctx.correlationId });
}

export async function getMe(ctx: ActorContext, deps: IdentityDeps) {
  const user = await deps.users.findById(ctx.tenantId, ctx.userId);
  if (!user || user.status !== 'ACTIVE') throw unauthorized('Invalid session');
  const membership = await deps.memberships.findByUserAndTenant(ctx.userId, ctx.tenantId);
  if (!membership || membership.status !== 'ACTIVE') throw forbidden('Membership is not active');
  const roles = await deps.roles.findByIds(ctx.tenantId, membership.roleIds);
  const activeRoles = roles.filter((r) => r.status === 'ACTIVE');
  return {
    user: toSafeUser(user),
    membership: {
      _id: membership._id,
      tenantId: membership.tenantId,
      organizationId: membership.organizationId,
      branchId: membership.branchId,
      status: membership.status,
    },
    roles: activeRoles.map((r) => ({ _id: r._id, name: r.name, permissions: r.permissions })),
    permissions: resolvePermissions(activeRoles),
  };
}

export interface CreateUserInput {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
  roleIds?: string[];
  organizationId?: string;
  branchId?: string;
}

export async function createUser(ctx: ActorContext, input: CreateUserInput, deps: IdentityDeps) {
  if (input.password.length < 8) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters', statusCode: 400 });
  }
  const email = input.email.trim().toLowerCase();
  const existing = await deps.users.findByEmail(ctx.tenantId, email);
  if (existing) {
    throw new AppError({ code: 'CONFLICT', message: `Duplicate value for email`, statusCode: 409, fields: { duplicateFields: { email } } });
  }
  let roleIds: string[] = [];
  if (input.roleIds && input.roleIds.length > 0) {
    const roles = await deps.roles.findByIds(ctx.tenantId, input.roleIds);
    const found = new Set(roles.filter((r) => r.status === 'ACTIVE').map((r) => r._id));
    const missing = input.roleIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new AppError({ code: 'VALIDATION_ERROR', message: 'Unknown or inactive roles', statusCode: 400, fields: { roleIds: missing } });
    }
    roleIds = [...found];
  }
  const passwordHash = await deps.hasher.hash(input.password);
  const created = await deps.users.create({
    tenantId: ctx.tenantId,
    username: input.username.trim(),
    email,
    passwordHash,
    firstName: input.firstName?.trim(),
    lastName: input.lastName?.trim(),
    createdBy: ctx.userId,
  });
  const membership = await deps.memberships.create({
    tenantId: ctx.tenantId,
    organizationId: input.organizationId,
    branchId: input.branchId,
    userId: created._id,
    roleIds,
    createdBy: ctx.userId,
  });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: AUTH_ACTIONS.USER_CREATED,
    entityType: 'user',
    entityId: created._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { email: created.email, username: created.username, membershipId: membership._id, roleIds },
  });
  return { user: toSafeUser(created), membershipId: membership._id };
}

export interface AssignRoleInput {
  userId: string;
  roleIds: string[];
}

export async function assignRole(ctx: ActorContext, input: AssignRoleInput, deps: IdentityDeps) {
  const membership = await deps.memberships.findByUserAndTenant(input.userId, ctx.tenantId);
  if (!membership) throw new AppError({ code: 'NOT_FOUND', message: 'Membership not found', statusCode: 404 });
  const roles = await deps.roles.findByIds(ctx.tenantId, input.roleIds);
  const found = new Set(roles.filter((r) => r.status === 'ACTIVE').map((r) => r._id));
  const missing = input.roleIds.filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'Unknown or inactive roles', statusCode: 400, fields: { roleIds: missing } });
  }
  const before = { roleIds: membership.roleIds };
  const updated = await deps.memberships.setRoles(ctx.tenantId, membership._id, [...found], ctx.userId);
  if (!updated) throw new AppError({ code: 'NOT_FOUND', message: 'Membership not found', statusCode: 404 });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: AUTH_ACTIONS.ROLE_ASSIGNED,
    entityType: 'membership',
    entityId: membership._id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before,
    after: { roleIds: updated.roleIds },
  });
  return updated;
}

export async function listUsers(ctx: ActorContext, page: number, limit: number, deps: IdentityDeps) {
  const result = await deps.users.list(ctx.tenantId, page, limit);
  return { data: result.data.map(toSafeUser), total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages };
}

export interface UserWithRoles extends ReturnType<typeof toSafeUser> {
  membershipStatus: 'ACTIVE' | 'DISABLED' | null;
  roles: Array<{ _id: string; name: string }>;
}

/**
 * Same as listUsers, enriched with each user's roles (joined from
 * memberships in one extra query — no N+1) for the account-management
 * screen, which must show who can only view vs who can edit.
 */
export async function listUsersWithRoles(ctx: ActorContext, page: number, limit: number, deps: IdentityDeps): Promise<{ data: UserWithRoles[]; total: number; page: number; limit: number; totalPages: number }> {
  const result = await listUsers(ctx, page, limit, deps);
  const memberships = await deps.memberships.findByTenant(ctx.tenantId);
  const membershipByUser = new Map(memberships.map((m) => [m.userId, m]));
  const allRoleIds = [...new Set(memberships.flatMap((m) => m.roleIds))];
  const roles = await deps.roles.findByIds(ctx.tenantId, allRoleIds);
  const roleById = new Map(roles.map((r) => [r._id, r]));

  const data: UserWithRoles[] = result.data.map((user) => {
    const membership = membershipByUser.get(user._id);
    const userRoles = (membership?.roleIds ?? []).flatMap((rid) => {
      const role = roleById.get(rid);
      return role ? [{ _id: role._id, name: role.name }] : [];
    });
    return { ...user, membershipStatus: membership?.status ?? null, roles: userRoles };
  });

  return { ...result, data };
}

export async function getUserById(ctx: ActorContext, id: string, deps: IdentityDeps) {
  const user = await deps.users.findById(ctx.tenantId, id);
  if (!user) throw new AppError({ code: 'NOT_FOUND', message: 'User not found', statusCode: 404 });
  return toSafeUser(user);
}

/** Deactivates/reactivates a user's account. A user cannot disable themself (avoids a self-lockout with no recovery path). */
export async function setUserStatus(ctx: ActorContext, id: string, status: User['status'], deps: IdentityDeps) {
  if (id === ctx.userId && status === 'DISABLED') {
    throw forbidden('You cannot deactivate your own account');
  }
  const updated = await deps.users.setStatus(ctx.tenantId, id, status, ctx.userId);
  if (!updated) throw new AppError({ code: 'NOT_FOUND', message: 'User not found', statusCode: 404 });
  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: AUTH_ACTIONS.USER_STATUS_CHANGED,
    entityType: 'user',
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    after: { status },
  });
  return toSafeUser(updated);
}

export interface RegisterInput {
  companyName: string;
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  correlationId?: string;
}

/** Server-generated tenant id. Never accepted from the client. */
function generateTenantId(): string {
  return `tnt_${randomBytes(8).toString('hex')}`;
}

/** Normalize company name into a URL-safe slug using only Node builtins. */
export function slugifyCompanyName(companyName: string): string {
  const slug = companyName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60);
  return slug || 'empresa';
}

/** Resolve slug collisions deterministically with a short suffix. */
async function uniqueSlug(tenants: ITenantStore, companyName: string): Promise<string> {
  const base = slugifyCompanyName(companyName);
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${randomBytes(2).toString('hex')}`;
    const existing = await tenants.findBySlug(candidate);
    if (!existing) return candidate;
  }
  // Astronomically unlikely fallback: timestamp suffix.
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Register a new company: Tenant + owner Role + User + Membership + Session
 * created atomically inside a single MongoDB transaction.
 */
export async function register(input: RegisterInput, deps: RegisterDeps) {
  const companyName = input.companyName.trim();
  const username = input.username.trim();
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 8) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters', statusCode: 400 });
  }

  const tenantId = generateTenantId();
  const slug = await uniqueSlug(deps.tenants, companyName);
  const runTx: TxRunner = deps.tx ?? ((fn) => withTransaction((session) => fn(session as TxSession)));

  const result = await runTx(async (session) => {
    const tenant = await deps.tenants.create(
      { tenantId, name: companyName, slug, createdBy: email },
      session,
    );

    const role = await deps.roles.create(
      {
        tenantId,
        name: 'owner',
        description: 'Propietario de la empresa con permisos completos',
        permissions: [...ALL_PERMISSIONS],
        createdBy: email,
      },
      session,
    );

    const duplicate = await deps.users.findByEmail(tenantId, email, session);
    if (duplicate) {
      throw new AppError({ code: 'CONFLICT', message: 'Duplicate value for email', statusCode: 409, fields: { duplicateFields: { email } } });
    }

    const passwordHash = await deps.hasher.hash(input.password);
    const created = await deps.users.create(
      {
        tenantId,
        username,
        email,
        passwordHash,
        firstName: input.firstName?.trim(),
        lastName: input.lastName?.trim(),
        createdBy: email,
      },
      session,
    );

    const membership = await deps.memberships.create(
      { tenantId, userId: created._id, roleIds: [role._id], createdBy: created._id },
      session,
    );

    const sessionId = randomUUID();
    const issued = deps.tokens.issueRefresh({ userId: created._id, tenantId, sessionId });
    await deps.sessions.create(
      {
        tenantId,
        userId: created._id,
        sessionId,
        tokenHash: deps.tokens.hashToken(issued.token),
        expiresAt: issued.expiresAt,
      },
      session,
    );
    const accessToken = deps.tokens.issueAccess({ userId: created._id, tenantId, sessionId });
    const permissions = [...ALL_PERMISSIONS].sort();

    await deps.audit.record(
      {
        tenantId,
        userId: created._id,
        action: AUTH_ACTIONS.REGISTER_SUCCESS,
        entityType: 'tenant',
        entityId: tenantId,
        result: 'SUCCESS',
        correlationId: input.correlationId,
        after: { email, username, slug, membershipId: membership._id, roleId: role._id, sessionId },
      },
      session,
    );

    return {
      accessToken,
      refreshToken: issued.token,
      tokenType: 'Bearer' as const,
      expiresIn: deps.tokens.accessTtlSeconds(),
      tenantId,
      sessionId,
      user: toSafeUser(created),
      tenant: { tenantId: tenant.tenantId, name: tenant.name, slug: tenant.slug },
      permissions,
    };
  });

  try {
    await deps.emailProvider.sendWelcomeEmail({
      to: email,
      firstName: input.firstName,
      companyName,
    });
  } catch (error) {
    console.warn('Welcome email could not be sent', {
      email,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}

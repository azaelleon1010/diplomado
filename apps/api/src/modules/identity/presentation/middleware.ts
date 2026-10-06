/**
 * Auth middleware — fills req.userId / req.tenantId for requestLogger.
 * Extends the Express.Request declaration from trace.ts with sessionId.
 */
import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '@erp/errors';
import { hasPermission } from '../domain/permissions';
import type { IMembershipStore, IRoleStore, ISessionStore, ITokenIssuer } from '../domain/ports';
import type { ITenantStore } from '../../tenant/domain/ports';
import type { IUserStore } from '../domain/ports';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionId?: string;
      grantedPermissions?: string[];
    }
  }
}

export interface AuthMiddlewareDeps {
  tokens: ITokenIssuer;
  sessions: ISessionStore;
  memberships: IMembershipStore;
  roles: IRoleStore;
  users: Pick<IUserStore, 'findStatusById'>;
  tenants: Pick<ITenantStore, 'findById'>;
}

function bearerToken(req: Request): string | null {
  const header = req.get('authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Validates the access JWT, checks the session is still live
 * (so logout actually invalidates access), and populates request context.
 */
export function authenticate(deps: AuthMiddlewareDeps) {
  return async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = bearerToken(req);
    if (!token) {
      next(unauthorized('Missing or invalid Authorization header'));
      return;
    }
    let claims;
    try {
      claims = deps.tokens.verifyAccess(token);
    } catch (err) {
      next(err);
      return;
    }
    const session = await deps.sessions.findBySessionId(claims.sessionId);
    if (
      session === null ||
      session.revokedAt != null ||
      session.expiresAt.getTime() <= Date.now() ||
      session.userId !== claims.sub ||
      session.tenantId !== claims.tenantId
    ) {
      next(unauthorized('Session is no longer valid'));
      return;
    }

    const [userStatus, tenant] = await Promise.all([
      deps.users.findStatusById(claims.tenantId, claims.sub),
      deps.tenants.findById(claims.tenantId),
    ]);
    if (userStatus !== 'ACTIVE') {
      next(unauthorized('User is no longer active'));
      return;
    }
    if (!tenant || tenant.status !== 'ACTIVE') {
      next(forbidden('Tenant is not active'));
      return;
    }
    req.userId = claims.sub;
    req.tenantId = claims.tenantId;
    req.sessionId = claims.sessionId;
    next();
  };
}

/**
 * Requires a verified tenant context. Never accepts tenantId from
 * body/query/params to bypass the token context.
 */
export function requireTenant() {
  return function requireTenant(req: Request, _res: Response, next: NextFunction): void {
    if (!req.tenantId || req.tenantId.trim() === '') {
      next(unauthorized('Tenant context is missing'));
      return;
    }
    next();
  };
}

/**
 * Server-side permission check within the request tenant.
 * Permissions are resolved from roles — never from client claims.
 */
async function resolveGrantedPermissions(req: Request, deps: AuthMiddlewareDeps): Promise<string[] | null> {
  const userId = req.userId;
  const tenantId = req.tenantId;
  if (!userId || !tenantId) return null;

  const membership = await deps.memberships.findByUserAndTenant(userId, tenantId);
  if (!membership || membership.status !== 'ACTIVE') {
    req.grantedPermissions = [];
    return req.grantedPermissions;
  }
  const roles = await deps.roles.findByIds(tenantId, membership.roleIds);
  const granted: string[] = [];
  for (const role of roles) {
    if (role.status === 'ACTIVE' && role.tenantId === tenantId) granted.push(...role.permissions);
  }
  req.grantedPermissions = [...new Set(granted)];
  return req.grantedPermissions;
}

/** Server-side permission check within the request tenant. */
export function requirePermission(deps: AuthMiddlewareDeps, permission: string) {
  return async function requirePermission(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const granted = await resolveGrantedPermissions(req, deps);
    if (granted === null) {
      next(unauthorized('Authentication required'));
      return;
    }
    if (!hasPermission(granted, permission)) {
      next(forbidden('Insufficient permissions'));
      return;
    }
    next();
  };
}

/** Allows a route guarded by any one of several server-resolved permissions. */
export function requireAnyPermission(deps: AuthMiddlewareDeps, permissions: readonly string[]) {
  return async function requireAnyPermission(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const granted = await resolveGrantedPermissions(req, deps);
    if (granted === null) {
      next(unauthorized('Authentication required'));
      return;
    }
    if (!permissions.some((permission) => hasPermission(granted, permission))) {
      next(forbidden('Insufficient permissions'));
      return;
    }
    next();
  };
}

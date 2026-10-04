/**
 * Auth middleware — fills req.userId / req.tenantId for requestLogger.
 * Extends the Express.Request declaration from trace.ts with sessionId.
 */
import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '@erp/errors';
import { hasPermission } from '../domain/permissions';
import type { IMembershipStore, IRoleStore, ISessionStore, ITokenIssuer } from '../domain/ports';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionId?: string;
    }
  }
}

export interface AuthMiddlewareDeps {
  tokens: ITokenIssuer;
  sessions: ISessionStore;
  memberships: IMembershipStore;
  roles: IRoleStore;
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
export function requirePermission(deps: AuthMiddlewareDeps, permission: string) {
  return async function requirePermission(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const userId = req.userId;
    const tenantId = req.tenantId;
    if (!userId || !tenantId) {
      next(unauthorized('Authentication required'));
      return;
    }
    const membership = await deps.memberships.findByUserAndTenant(userId, tenantId);
    if (!membership || membership.status !== 'ACTIVE') {
      next(forbidden('Membership is not active'));
      return;
    }
    const roles = await deps.roles.findByIds(tenantId, membership.roleIds);
    const granted: string[] = [];
    for (const role of roles) {
      if (role.status === 'ACTIVE' && role.tenantId === tenantId) granted.push(...role.permissions);
    }
    if (!hasPermission(granted, permission)) {
      next(forbidden('Insufficient permissions'));
      return;
    }
    next();
  };
}

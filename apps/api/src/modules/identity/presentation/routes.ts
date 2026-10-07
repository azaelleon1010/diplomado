/**
 * Identity routes + composition root.
 * Routers are built from explicit dependencies (no service locator).
 */
import { Router } from 'express';
import { getConfig } from '@erp/config';
import { clientIp, createRateLimiter, loginAccountKey } from '../../../middleware/rateLimit';
import type { RegisterDeps } from '../application/usecases';
import type { PasswordResetDeps } from '../application/passwordReset';
import type { ITenantStore } from '../../tenant/domain/ports';
import { PERMISSIONS } from '../domain/permissions';
import { BcryptHasher } from '../infrastructure/hasher';
import { MongoAuditSink, MongoMembershipStore, MongoPasswordResetStore, MongoRoleStore, MongoSessionStore, MongoUserStore } from '../infrastructure/repositories';
import { MongoTenantStore } from '../../tenant/infrastructure/repositories';
import { JwtIssuer } from '../infrastructure/tokens';
import { createAuthController, createRolesController, createUsersController } from './controllers';
import { authenticate, requirePermission, requireTenant, type AuthMiddlewareDeps } from './middleware';
import { ResendEmailProvider } from '../../notifications/infrastructure/resend';
import type { IEmailProvider } from '../../notifications/domain/ports';

export function buildIdentityDeps(emailProvider: IEmailProvider = new ResendEmailProvider()): PasswordResetDeps {
  const users = new MongoUserStore();
  const roles = new MongoRoleStore();
  const memberships = new MongoMembershipStore();
  const sessions = new MongoSessionStore();
  const tenants: ITenantStore = new MongoTenantStore();

  return {
    users,
    roles,
    memberships,
    sessions,
    tenants,
    audit: new MongoAuditSink(),
    hasher: new BcryptHasher(),
    tokens: new JwtIssuer(),
    emailProvider,
    resetTokens: new MongoPasswordResetStore(),
  };
}

export function buildAuthMiddleware(deps: RegisterDeps): AuthMiddlewareDeps {
  return {
    tokens: deps.tokens,
    sessions: deps.sessions,
    memberships: deps.memberships,
    roles: deps.roles,
    users: deps.users,
    tenants: deps.tenants,
  };
}

/** POST /login, POST /refresh, POST /register, POST /forgot-password, POST /reset-password (public). POST /logout (protected). */
export function createAuthRouter(deps: PasswordResetDeps, auth: AuthMiddlewareDeps) {
  const router = Router();
  const controller = createAuthController(deps);
  const limits = getConfig().authRateLimit;
  const perIp = (name: string, max: number) =>
    createRateLimiter({ name, windowMs: limits.windowMs, max, key: clientIp });
  const loginPerAccount = createRateLimiter({ name: 'login-account', windowMs: limits.windowMs, max: limits.loginPerAccount, key: loginAccountKey });
  const publicPerIp = perIp('auth-public', limits.publicPerIp);
  // Same key shape as login (client IP + tenant + email): one bucket per account attempting a reset.
  const forgotPasswordPerAccount = createRateLimiter({ name: 'forgot-password-account', windowMs: limits.windowMs, max: limits.passwordResetPerAccount, key: loginAccountKey });

  router.get('/tenant/:slug', publicPerIp, controller.getTenantBySlug);
  router.post('/register', perIp('register', limits.registerPerIp), controller.postRegister);
  router.post('/login', perIp('login-ip', limits.loginPerIp), loginPerAccount, controller.postLogin);
  router.post('/refresh', publicPerIp, controller.postRefresh);
  router.post('/forgot-password', perIp('forgot-password-ip', limits.passwordResetPerIp), forgotPasswordPerAccount, controller.postForgotPassword);
  router.post('/reset-password', publicPerIp, controller.postResetPassword);
  router.post('/logout', authenticate(auth), requireTenant(), controller.postLogout);

  return router;
}

/** GET /me (protected). Mounted at /api/v1. */
export function createMeRouter(deps: PasswordResetDeps, auth: AuthMiddlewareDeps) {
  const router = Router();
  const controller = createAuthController(deps);
  router.get('/me', authenticate(auth), requireTenant(), controller.getMe);
  return router;
}

/** Administrative user management. Mounted at /api/v1/users. */
export function createUsersRouter(deps: RegisterDeps, auth: AuthMiddlewareDeps) {
  const router = Router();
  const controller = createUsersController(deps);
  const guard = [authenticate(auth), requireTenant()];
  router.get('/', ...guard, requirePermission(auth, PERMISSIONS.SYSTEM_USERS_READ), controller.list);
  router.post('/', ...guard, requirePermission(auth, PERMISSIONS.SYSTEM_USERS_WRITE), controller.create);
  router.get('/:id', ...guard, requirePermission(auth, PERMISSIONS.SYSTEM_USERS_READ), controller.getById);
  router.post('/:id/roles', ...guard, requirePermission(auth, PERMISSIONS.SYSTEM_USERS_WRITE), controller.assignRoles);
  router.patch('/:id/status', ...guard, requirePermission(auth, PERMISSIONS.SYSTEM_USERS_WRITE), controller.setStatus);
  return router;
}

/**
 * Role management (create/edit the permission sets accounts are assigned
 * to — AGENTS.md §30, never a hardcoded admin/viewer split). Reuses
 * system.users.read/write: role administration is part of the same
 * "system/accounts" area as user management in the Web nav, and every
 * tenant that could manage users already has these. Mounted at /api/v1/roles.
 */
export function createRolesRouter(deps: RegisterDeps, auth: AuthMiddlewareDeps) {
  const router = Router();
  const controller = createRolesController(deps);
  const guard = [authenticate(auth), requireTenant()];
  const read = requirePermission(auth, PERMISSIONS.SYSTEM_USERS_READ);
  const write = requirePermission(auth, PERMISSIONS.SYSTEM_USERS_WRITE);
  router.get('/', ...guard, read, controller.list);
  router.post('/', ...guard, write, controller.create);
  router.get('/:id', ...guard, read, controller.getById);
  router.patch('/:id', ...guard, write, controller.update);
  return router;
}

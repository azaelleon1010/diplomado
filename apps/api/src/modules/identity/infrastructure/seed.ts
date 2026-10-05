/**
 * Idempotent seed for the initial TRAMATECH tenant administrator.
 *
 * Credentials come ONLY from environment variables (never hardcoded):
 *   SEED_TENANT_ID    (default: TRAMATECH)
 *   SEED_ADMIN_EMAIL  (default: admin@tramatech.mx)
 *   SEED_ADMIN_PASSWORD (required, min 8 chars — never logged)
 *
 * Running twice creates no duplicates (find-or-create per entity).
 */
import { getConfig } from '@erp/config';
import { createLogger } from '@erp/logger';
import { AUTH_ACTIONS } from '../domain/entities';
import { ALL_PERMISSIONS } from '../domain/permissions';
import type { IdentityDeps } from '../application/usecases';

const logger = createLogger('identity:seed');

export interface SeedInput {
  tenantId: string;
  adminEmail: string;
  adminPassword: string;
  adminUsername?: string;
}

export function readSeedInput(): SeedInput {
  const tenantId = (process.env.SEED_TENANT_ID ?? 'TRAMATECH').trim() || 'TRAMATECH';
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@tramatech.mx').trim().toLowerCase() || 'admin@tramatech.mx';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '';
  if (adminPassword.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD is required (min 8 characters) to seed the initial administrator');
  }
  return { tenantId, adminEmail, adminPassword, adminUsername: process.env.SEED_ADMIN_USERNAME?.trim() || 'admin' };
}

export async function seedIdentity(
  deps: IdentityDeps,
  input: SeedInput,
): Promise<{ tenantId: string; adminEmail: string; roleCreated: boolean; userCreated: boolean; membershipCreated: boolean }> {
  void getConfig();
  const email = input.adminEmail.toLowerCase();

  let role = await deps.roles.findByName(input.tenantId, 'admin');
  let roleCreated = false;
  if (!role) {
    role = await deps.roles.create({
      tenantId: input.tenantId,
      name: 'admin',
      description: 'Tenant administrator with full permissions for the current phase',
      permissions: [...ALL_PERMISSIONS],
      createdBy: 'seed',
    });
    roleCreated = true;
  } else {
    // Sync new permissions into pre-existing admin roles (e.g. when a new
    // module extends the catalog). Never removes custom permissions.
    const existingRole = role;
    const missing = ALL_PERMISSIONS.filter((p) => !existingRole.permissions.includes(p));
    if (missing.length > 0) {
      const updated = await deps.roles.setPermissions(input.tenantId, existingRole._id, [...existingRole.permissions, ...missing], 'seed');
      if (updated) role = updated;
    }
  }

  let user = await deps.users.findByEmail(input.tenantId, email);
  let userCreated = false;
  if (!user) {
    const passwordHash = await deps.hasher.hash(input.adminPassword);
    user = await deps.users.create({
      tenantId: input.tenantId,
      username: input.adminUsername ?? 'admin',
      email,
      passwordHash,
      firstName: 'Tenant',
      lastName: 'Administrator',
      createdBy: 'seed',
    });
    userCreated = true;
  }

  let membership = await deps.memberships.findByUserAndTenant(user._id, input.tenantId);
  let membershipCreated = false;
  if (!membership) {
    membership = await deps.memberships.create({
      tenantId: input.tenantId,
      userId: user._id,
      roleIds: [role._id],
      createdBy: 'seed',
    });
    membershipCreated = true;
  } else if (!membership.roleIds.includes(role._id)) {
    await deps.memberships.setRoles(input.tenantId, membership._id, [...membership.roleIds, role._id], 'seed');
  }

  await deps.audit.record({
    tenantId: input.tenantId,
    userId: user._id,
    action: AUTH_ACTIONS.USER_CREATED,
    entityType: 'user',
    entityId: user._id,
    result: 'SUCCESS',
    correlationId: 'seed',
    after: { email, source: 'seed', created: userCreated },
  });

  // Never log the password. Email/tenant are operational identifiers, safe to log.
  logger.info({ tenantId: input.tenantId, adminEmail: email, roleCreated, userCreated, membershipCreated }, 'identity seed complete');
  return { tenantId: input.tenantId, adminEmail: email, roleCreated, userCreated, membershipCreated };
}

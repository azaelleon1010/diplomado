/**
 * Role use cases — orchestrate ports, enforce business rules.
 * No Express, no Mongoose here.
 *
 * Roles are the only place permissions live (AGENTS.md §30): never admin/
 * user/manager, always a named, editable set of granular permission
 * strings from the shared catalog (packages/types/src/permissions.ts,
 * re-exported by apps/api/src/modules/identity/domain/permissions.ts).
 */
import { AppError, forbidden, notFound, versionConflict } from '@erp/errors';
import { AUTH_ACTIONS, sanitizeForAudit, type AuditResult, type Role } from '../domain/entities';
import { ALL_PERMISSIONS } from '../domain/permissions';
import type { IAuditSink, IRoleStore } from '../domain/ports';
import type { ActorContext } from './usecases';

export interface RoleDeps {
  roles: IRoleStore;
  audit: IAuditSink;
}

/** The bootstrap role created on company registration; it must always stay usable. */
const PROTECTED_ROLE_NAME = 'owner';

async function audit(deps: RoleDeps, event: { tenantId: string; userId: string; action: string; entityId: string; before?: unknown; after?: unknown; result: AuditResult; correlationId?: string }) {
  await deps.audit.record({
    tenantId: event.tenantId,
    userId: event.userId,
    action: event.action,
    entityType: 'role',
    entityId: event.entityId,
    before: sanitizeForAudit(event.before),
    after: sanitizeForAudit(event.after),
    result: event.result,
    correlationId: event.correlationId,
  });
}

function assertKnownPermissions(permissions: readonly string[]): void {
  const known = new Set<string>(ALL_PERMISSIONS);
  const unknown = permissions.filter((p) => !known.has(p));
  if (unknown.length > 0) {
    throw new AppError({ code: 'VALIDATION_ERROR', message: 'Unknown permissions', statusCode: 400, fields: { permissions: unknown } });
  }
}

export async function listRoles(ctx: ActorContext, deps: RoleDeps): Promise<Role[]> {
  return deps.roles.list(ctx.tenantId);
}

export async function getRole(ctx: ActorContext, id: string, deps: RoleDeps): Promise<Role> {
  const role = await deps.roles.findById(ctx.tenantId, id);
  if (!role) throw notFound('Role not found');
  return role;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: string[];
}

export async function createRole(ctx: ActorContext, input: CreateRoleInput, deps: RoleDeps): Promise<Role> {
  const name = input.name.trim();
  const permissions = [...new Set(input.permissions)];
  assertKnownPermissions(permissions);

  const existing = await deps.roles.findByName(ctx.tenantId, name);
  if (existing) {
    throw new AppError({ code: 'CONFLICT', message: 'Duplicate value for name', statusCode: 409, fields: { duplicateFields: { name } } });
  }

  const created = await deps.roles.create({ tenantId: ctx.tenantId, name, description: input.description?.trim(), permissions, createdBy: ctx.userId });
  await audit(deps, { tenantId: ctx.tenantId, userId: ctx.userId, action: AUTH_ACTIONS.ROLE_CREATED, entityId: created._id, result: 'SUCCESS', correlationId: ctx.correlationId, after: { name: created.name, permissions: created.permissions } });
  return created;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
  status?: Role['status'];
  expectedVersion: number;
}

export async function updateRole(ctx: ActorContext, id: string, input: UpdateRoleInput, deps: RoleDeps): Promise<Role> {
  const current = await deps.roles.findById(ctx.tenantId, id);
  if (!current) throw notFound('Role not found');

  // The bootstrap role must always stay usable — losing it would lock the
  // whole tenant out of administration with no recovery path.
  if (current.name === PROTECTED_ROLE_NAME && input.status === 'DISABLED') {
    throw forbidden(`The "${PROTECTED_ROLE_NAME}" role cannot be disabled`);
  }

  const name = input.name?.trim();
  if (name !== undefined && name !== current.name) {
    const duplicate = await deps.roles.findByName(ctx.tenantId, name);
    if (duplicate && duplicate._id !== id) {
      throw new AppError({ code: 'CONFLICT', message: 'Duplicate value for name', statusCode: 409, fields: { duplicateFields: { name } } });
    }
  }

  const permissions = input.permissions ? [...new Set(input.permissions)] : undefined;
  if (permissions) assertKnownPermissions(permissions);

  const updated = await deps.roles.update(
    ctx.tenantId,
    id,
    { name, description: input.description?.trim(), permissions, status: input.status },
    input.expectedVersion,
    ctx.userId,
  );
  if (!updated) throw versionConflict(current.version);

  await audit(deps, {
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    action: AUTH_ACTIONS.ROLE_UPDATED,
    entityId: id,
    result: 'SUCCESS',
    correlationId: ctx.correlationId,
    before: { name: current.name, permissions: current.permissions, status: current.status },
    after: { name: updated.name, permissions: updated.permissions, status: updated.status },
  });
  return updated;
}

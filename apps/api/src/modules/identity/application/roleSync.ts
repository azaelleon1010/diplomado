/**
 * Additive permission sync for full-access system roles.
 *
 * `owner` (created on company registration) and `admin` (seed) are meant to
 * hold the whole catalog, but they only received the permissions that
 * existed when they were created. When the catalog grows, this use case adds
 * the missing ones. It never removes permissions, never touches custom roles
 * and is idempotent. Dry run unless `apply` is true.
 */
import { AUTH_ACTIONS } from '../domain/entities';
import { ALL_PERMISSIONS, missingPermissions } from '../domain/permissions';
import type { IAuditSink, ISystemRoleStore } from '../domain/ports';

export const FULL_ACCESS_ROLE_NAMES = ['owner', 'admin'] as const;

export interface RoleSyncDeps {
  roles: ISystemRoleStore;
  audit: IAuditSink;
}

export interface RoleSyncEntry {
  tenantId: string;
  roleId: string;
  roleName: string;
  missing: string[];
  applied: boolean;
}

export interface RoleSyncReport {
  apply: boolean;
  scanned: number;
  outdated: number;
  updated: number;
  entries: RoleSyncEntry[];
}

export async function syncFullAccessRolePermissions(
  deps: RoleSyncDeps,
  options: { apply: boolean; actor?: string; catalog?: readonly string[] },
): Promise<RoleSyncReport> {
  const actor = options.actor ?? 'system:role-permission-sync';
  const catalog = options.catalog ?? ALL_PERMISSIONS;
  const roles = await deps.roles.findActiveByNameAcrossTenants([...FULL_ACCESS_ROLE_NAMES]);
  const entries: RoleSyncEntry[] = [];

  for (const role of roles) {
    const missing = missingPermissions(role.permissions, catalog);
    if (missing.length === 0) continue;

    let applied = false;
    if (options.apply) {
      const updated = await deps.roles.setPermissions(role.tenantId, role._id, [...role.permissions, ...missing], actor);
      applied = updated !== null;
      if (applied) {
        await deps.audit.record({
          tenantId: role.tenantId,
          userId: actor,
          action: AUTH_ACTIONS.ROLE_PERMISSIONS_SYNCED,
          entityType: 'role',
          entityId: role._id,
          before: { permissionCount: role.permissions.length },
          after: { added: missing },
          result: 'SUCCESS',
        });
      }
    }
    entries.push({ tenantId: role.tenantId, roleId: role._id, roleName: role.name, missing, applied });
  }

  return {
    apply: options.apply,
    scanned: roles.length,
    outdated: entries.length,
    updated: entries.filter((entry) => entry.applied).length,
    entries,
  };
}

/**
 * Permission catalog — the backend is the final authority.
 * Permissions are never trusted from client claims; they are always
 * resolved server-side from the user's roles within the tenant.
 */

export const PERMISSIONS = {
  INVENTORY_READ: 'inventory.read',
  INVENTORY_CREATE: 'inventory.create',
  INVENTORY_UPDATE: 'inventory.update',
  INVENTORY_DELETE: 'inventory.delete',
  INVENTORY_WRITE: 'inventory.write',
  INVENTORY_WITHDRAW: 'inventory.withdraw',
  INVENTORY_TRANSFER: 'inventory.transfer',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_STOCK_IN: 'inventory.stock.in',
  INVENTORY_STOCK_OUT: 'inventory.stock.out',
  INVENTORY_STOCK_ADJUST: 'inventory.stock.adjust',
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_ASSIGN: 'maintenance.assign',
  PRODUCTION_READ: 'production.read',
  PRODUCTION_WRITE: 'production.write',
  PURCHASING_READ: 'purchasing.read',
  PURCHASING_WRITE: 'purchasing.write',
  HR_READ_SELF: 'hr.read.self',
  HR_READ_TEAM: 'hr.read.team',
  HR_WRITE: 'hr.write',
  SYSTEM_USERS_READ: 'system.users.read',
  SYSTEM_USERS_WRITE: 'system.users.write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Every permission known to the platform in this phase. */
export const ALL_PERMISSIONS: readonly string[] = Object.values(PERMISSIONS);

/** Wildcard grants everything. Reserved for the seed administrator role. */
export const WILDCARD_PERMISSION = '*';

export function hasPermission(granted: readonly string[], required: string): boolean {
  if (granted.includes(WILDCARD_PERMISSION)) return true;
  return granted.includes(required);
}

/** Union of permissions across roles (deduplicated, stable order). */
export function resolvePermissions(roles: ReadonlyArray<{ permissions: readonly string[] }>): string[] {
  const set = new Set<string>();
  for (const role of roles) for (const p of role.permissions) set.add(p);
  return [...set].sort();
}

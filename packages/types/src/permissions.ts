/**
 * Permission catalog shared by API, Web and Mobile.
 *
 * The API is the final authority: it resolves grants from the user's roles
 * inside the tenant and checks them on every route. Web/Mobile only use this
 * catalog to hide actions the server would reject anyway.
 *
 * Rules for evolving the catalog:
 * - Never rename or remove a published permission (stored in roles).
 * - New permissions are additive; existing owner/admin roles receive them
 *   through the explicit role-permission sync script, never silently.
 */
export const PERMISSIONS = {
  // Inventory
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
  // Maintenance
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_ASSIGN: 'maintenance.assign',
  MAINTENANCE_READ: 'maintenance.read',
  MAINTENANCE_UPDATE: 'maintenance.update',
  MAINTENANCE_DELETE: 'maintenance.delete',
  MAINTENANCE_EXECUTE: 'maintenance.execute',
  MAINTENANCE_CLOSE: 'maintenance.close',
  // Production
  PRODUCTION_READ: 'production.read',
  PRODUCTION_CREATE: 'production.create',
  PRODUCTION_UPDATE: 'production.update',
  PRODUCTION_DELETE: 'production.delete',
  PRODUCTION_WRITE: 'production.write',
  PRODUCTION_APPROVE: 'production.approve',
  PRODUCTION_EXECUTE: 'production.execute',
  PRODUCTION_CANCEL: 'production.cancel',
  // Purchasing
  PURCHASING_READ: 'purchasing.read',
  PURCHASING_CREATE: 'purchasing.create',
  PURCHASING_UPDATE: 'purchasing.update',
  PURCHASING_DELETE: 'purchasing.delete',
  PURCHASING_WRITE: 'purchasing.write',
  PURCHASING_APPROVE: 'purchasing.approve',
  PURCHASING_RECEIVE: 'purchasing.receive',
  PURCHASING_CANCEL: 'purchasing.cancel',
  // Human resources
  HR_READ_SELF: 'hr.read.self',
  HR_READ_TEAM: 'hr.read.team',
  HR_WRITE_SELF: 'hr.write.self',
  HR_WRITE: 'hr.write',
  HR_APPROVE: 'hr.approve',
  // Finance
  FINANCE_READ: 'finance.read',
  FINANCE_CREATE: 'finance.create',
  FINANCE_UPDATE: 'finance.update',
  FINANCE_DELETE: 'finance.delete',
  FINANCE_POST: 'finance.post',
  FINANCE_APPROVE: 'finance.approve',
  // System administration
  SYSTEM_USERS_READ: 'system.users.read',
  SYSTEM_USERS_WRITE: 'system.users.write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Every permission known to the platform. */
export const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

/** Wildcard grants everything. Reserved for platform administration roles. */
export const WILDCARD_PERMISSION = '*';

export function hasPermission(granted: readonly string[], required: string): boolean {
  if (granted.includes(WILDCARD_PERMISSION)) return true;
  return granted.includes(required);
}

export function hasAnyPermission(granted: readonly string[], required: readonly string[]): boolean {
  if (granted.includes(WILDCARD_PERMISSION)) return true;
  return required.some((permission) => granted.includes(permission));
}

/** Union of permissions across roles (deduplicated, stable order). */
export function resolvePermissions(roles: ReadonlyArray<{ permissions: readonly string[] }>): string[] {
  const set = new Set<string>();
  for (const role of roles) for (const p of role.permissions) set.add(p);
  return [...set].sort();
}

/** Permissions from `catalog` that a role is missing (for additive syncs). */
export function missingPermissions(granted: readonly string[], catalog: readonly string[] = ALL_PERMISSIONS): string[] {
  if (granted.includes(WILDCARD_PERMISSION)) return [];
  return catalog.filter((permission) => !granted.includes(permission));
}

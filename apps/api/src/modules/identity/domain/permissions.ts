/**
 * Permission catalog — the backend is the final authority.
 * Permissions are never trusted from client claims; they are always
 * resolved server-side from the user's roles within the tenant.
 *
 * The catalog itself lives in @erp/types so Web and Mobile hide exactly
 * the actions this API enforces.
 */
export {
  ALL_PERMISSIONS,
  PERMISSIONS,
  WILDCARD_PERMISSION,
  hasAnyPermission,
  hasPermission,
  missingPermissions,
  resolvePermissions,
  type Permission,
} from '@erp/types';

/**
 * Shared administration contract for the Web client: roles (granular
 * permission sets) and user accounts. Mirrors apps/api/src/modules/
 * identity. AGENTS.md §30: never a hardcoded admin/viewer flag — a role is
 * a named, editable set of permission strings from the shared catalog in
 * ./permissions.ts. The API is the final authority on every rule (unknown
 * permissions, duplicate names, the owner role can't be disabled, a user
 * can't deactivate themself); this module only decides what the screen
 * shows.
 */
import type { InventoryRequestClient, InventoryRequestOptions } from './inventory';
import { ALL_PERMISSIONS, type Permission } from './permissions';

export type AdminRequestClient = InventoryRequestClient;
type Options = InventoryRequestOptions;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type RoleStatus = 'ACTIVE' | 'DISABLED';

export interface Role {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  permissions: string[];
  status: RoleStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type AccountStatus = 'ACTIVE' | 'DISABLED';

export interface AdminUser {
  _id: string;
  tenantId: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  status: AccountStatus;
  roles: Array<{ _id: string; name: string }>;
  membershipStatus: AccountStatus | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/** The bootstrap role created on company registration; the API refuses to disable it. */
export const PROTECTED_ROLE_NAME = 'owner';

const MODULE_LABEL: Record<string, string> = {
  inventory: 'Inventario',
  purchasing: 'Compras',
  production: 'Producción',
  maintenance: 'Mantenimiento',
  hr: 'RRHH',
  finance: 'Finanzas',
  system: 'Sistema',
};

const ACTION_LABEL: Record<string, string> = {
  read: 'Ver',
  'read.self': 'Ver (propio)',
  'read.team': 'Ver (equipo)',
  create: 'Crear',
  update: 'Editar',
  write: 'Editar',
  'write.self': 'Editar (propio)',
  delete: 'Eliminar',
  approve: 'Aprobar',
  receive: 'Recibir',
  cancel: 'Cancelar',
  execute: 'Ejecutar',
  close: 'Cerrar',
  post: 'Contabilizar',
  assign: 'Asignar',
  transfer: 'Transferir',
  withdraw: 'Retirar',
  adjust: 'Ajustar',
  'stock.in': 'Entradas de stock',
  'stock.out': 'Salidas de stock',
  'stock.adjust': 'Ajustes de stock',
  'users.read': 'Ver usuarios',
  'users.write': 'Editar usuarios',
};

export interface PermissionGroup {
  module: string;
  label: string;
  permissions: Array<{ value: Permission; label: string }>;
}

/** Groups the shared permission catalog by module for a checkbox picker UI. */
export function groupPermissions(catalog: readonly Permission[] = ALL_PERMISSIONS): PermissionGroup[] {
  const groups = new Map<string, PermissionGroup>();
  for (const permission of catalog) {
    const [module, ...rest] = permission.split('.');
    if (!module) continue;
    const action = rest.join('.');
    const group = groups.get(module) ?? { module, label: MODULE_LABEL[module] ?? module, permissions: [] };
    group.permissions.push({ value: permission, label: ACTION_LABEL[action] ?? action });
    groups.set(module, group);
  }
  return [...groups.values()];
}

/** Permissions that only grant read access — the "view only" quick template. */
export function readOnlyPermissions(catalog: readonly Permission[] = ALL_PERMISSIONS): Permission[] {
  return catalog.filter((p) => /\.(read)(\.|$)/.test(p));
}

/** Spanish messages for admin business errors (API messages are technical English). */
export function describeAdminError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { code, message, fields } = error as { code?: unknown; message?: unknown; fields?: Record<string, unknown> };
  const text = typeof message === 'string' ? message : '';
  if (code === 'VALIDATION_ERROR' && fields?.permissions) return `Permiso desconocido: ${(fields.permissions as string[]).join(', ')}`;
  if (code === 'CONFLICT' && text.toLowerCase().includes('duplicate value for name')) return 'Ya existe un rol con ese nombre.';
  if (code === 'CONFLICT' && text.toLowerCase().includes('duplicate value for email')) return 'Ya existe un usuario con ese correo.';
  if (code === 'FORBIDDEN' && text.toLowerCase().includes('owner')) return 'El rol "owner" no se puede desactivar.';
  if (code === 'FORBIDDEN' && text.toLowerCase().includes('own account')) return 'No puedes desactivar tu propia cuenta.';
  if (code === 'FORBIDDEN') return 'Tu rol no permite realizar esta acción.';
  if (code === 'VERSION_CONFLICT') return 'Otro usuario modificó este registro. Recarga para ver la versión más reciente.';
  if (code === 'NOT_FOUND') return 'El registro no existe.';
  return null;
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

function query(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '' && value !== false)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

const enc = encodeURIComponent;

export function createAdminApi(client: AdminRequestClient) {
  const get = <T>(path: string, token: string) => client.request<T>(path, { token });
  const send = <T>(path: string, token: string, body?: unknown, method: Options['method'] = 'POST') => client.request<T>(path, { method, token, body });

  return {
    // Roles
    listRoles: (token: string) => get<Role[]>('/api/v1/roles', token),
    getRole: (token: string, id: string) => get<Role>(`/api/v1/roles/${enc(id)}`, token),
    createRole: (token: string, body: { name: string; description?: string; permissions: string[] }) => send<Role>('/api/v1/roles', token, body),
    updateRole: (token: string, id: string, body: Record<string, unknown> & { expectedVersion: number }) => send<Role>(`/api/v1/roles/${enc(id)}`, token, body, 'PATCH'),

    // Users
    listUsers: async (token: string, params: { page?: number; limit?: number } = {}): Promise<Page<AdminUser>> => {
      const result = await client.page<AdminUser[]>(`/api/v1/users${query({ page: params.page ?? 1, limit: params.limit ?? 100 })}`, { token });
      const items = Array.isArray(result.data) ? result.data : [];
      const num = (k: string, d: number) => (typeof result.meta?.[k] === 'number' ? (result.meta[k] as number) : d);
      return { items, total: num('total', items.length), page: num('page', 1), limit: num('limit', items.length), totalPages: num('totalPages', 1) };
    },
    createUser: (token: string, body: { email: string; username: string; password: string; firstName?: string; lastName?: string; roleIds?: string[] }) =>
      send<{ user: { _id: string }; membershipId: string }>('/api/v1/users', token, body),
    assignRoles: (token: string, userId: string, roleIds: string[]) => send(`/api/v1/users/${enc(userId)}/roles`, token, { roleIds }),
    setUserStatus: (token: string, userId: string, status: AccountStatus) => send(`/api/v1/users/${enc(userId)}/status`, token, { status }, 'PATCH'),
  };
}

export type AdminApi = ReturnType<typeof createAdminApi>;

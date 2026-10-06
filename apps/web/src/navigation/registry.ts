/**
 * Web navigation contract. Permission strings mirror the backend catalog in
 * apps/api/src/modules/identity/domain/permissions.ts. An empty permission
 * list means the backend has no permission yet, so the route is denied until
 * the catalog defines one.
 */
export type NavigationSection =
  | 'Inicio'
  | 'Operaciones'
  | 'Personas'
  | 'Comercial'
  | 'Finanzas'
  | 'Datos'
  | 'Administración';

export interface RouteDefinition {
  path: string;
  title: string;
  section: NavigationSection;
  /** null means no permission is required; [] means no catalogued grant exists. */
  requiredAnyPermissions: readonly string[] | null;
  sidebar: boolean;
  command: boolean;
  icon: string;
}

export const ROUTE_DEFINITIONS: readonly RouteDefinition[] = [
  { path: '/dashboard', title: 'Dashboard', section: 'Inicio', requiredAnyPermissions: null, sidebar: true, command: true, icon: '⌂' },
  { path: '/assistant', title: 'Asistente', section: 'Inicio', requiredAnyPermissions: null, sidebar: false, command: true, icon: '✦' },
  { path: '/operations/inventory', title: 'Inventario', section: 'Operaciones', requiredAnyPermissions: ['inventory.read'], sidebar: true, command: true, icon: '▦' },
  { path: '/operations/warehouses', title: 'Almacenes', section: 'Operaciones', requiredAnyPermissions: ['inventory.read'], sidebar: true, command: true, icon: '▤' },
  { path: '/procurement/purchases', title: 'Compras', section: 'Operaciones', requiredAnyPermissions: ['purchasing.read'], sidebar: true, command: true, icon: '⇄' },
  { path: '/operations/production', title: 'Producción', section: 'Operaciones', requiredAnyPermissions: ['production.read'], sidebar: true, command: true, icon: '⚙' },
  { path: '/operations/maintenance', title: 'Mantenimiento', section: 'Operaciones', requiredAnyPermissions: ['maintenance.read'], sidebar: true, command: true, icon: '⌁' },
  { path: '/operations/quality', title: 'Calidad', section: 'Operaciones', requiredAnyPermissions: [], sidebar: true, command: true, icon: '◇' },
  { path: '/procurement/suppliers', title: 'Proveedores', section: 'Operaciones', requiredAnyPermissions: ['purchasing.read'], sidebar: true, command: true, icon: '♧' },
  { path: '/people/employees', title: 'Empleados', section: 'Personas', requiredAnyPermissions: ['hr.read.team'], sidebar: true, command: true, icon: '♙' },
  { path: '/people/attendance', title: 'Asistencia', section: 'Personas', requiredAnyPermissions: ['hr.read.team'], sidebar: true, command: true, icon: '◷' },
  { path: '/people/vacations', title: 'Vacaciones', section: 'Personas', requiredAnyPermissions: ['hr.read.team', 'hr.read.self'], sidebar: true, command: true, icon: '☼' },
  { path: '/sales/customers', title: 'Clientes', section: 'Comercial', requiredAnyPermissions: [], sidebar: true, command: true, icon: '♧' },
  { path: '/sales/orders', title: 'Ventas', section: 'Comercial', requiredAnyPermissions: [], sidebar: true, command: true, icon: '▣' },
  { path: '/finance/accounting', title: 'Contabilidad', section: 'Finanzas', requiredAnyPermissions: ['finance.read'], sidebar: true, command: true, icon: '∑' },
  { path: '/finance/receivables', title: 'Cuentas por cobrar', section: 'Finanzas', requiredAnyPermissions: ['finance.read'], sidebar: true, command: true, icon: '$' },
  { path: '/finance/payables', title: 'Cuentas por pagar', section: 'Finanzas', requiredAnyPermissions: ['finance.read'], sidebar: true, command: true, icon: '＄' },
  { path: '/finance/treasury', title: 'Tesorería', section: 'Finanzas', requiredAnyPermissions: ['finance.read'], sidebar: true, command: true, icon: '◈' },
  { path: '/master-data/products', title: 'Productos', section: 'Datos', requiredAnyPermissions: ['inventory.read'], sidebar: true, command: true, icon: '⬡' },
  { path: '/master-data/materials', title: 'Materiales', section: 'Datos', requiredAnyPermissions: ['inventory.read'], sidebar: true, command: true, icon: '◉' },
  { path: '/master-data/machines', title: 'Maquinaria', section: 'Datos', requiredAnyPermissions: ['production.read'], sidebar: true, command: true, icon: '⚙' },
  { path: '/analytics', title: 'Analítica', section: 'Administración', requiredAnyPermissions: [], sidebar: true, command: true, icon: '▥' },
  { path: '/integrations', title: 'Integraciones', section: 'Administración', requiredAnyPermissions: [], sidebar: true, command: true, icon: '⇌' },
  { path: '/administration', title: 'Administración', section: 'Administración', requiredAnyPermissions: ['system.users.read', 'system.users.write'], sidebar: true, command: true, icon: '⚙' },
];

export const SIDEBAR_SECTIONS: readonly NavigationSection[] = [
  'Inicio',
  'Operaciones',
  'Personas',
  'Comercial',
  'Finanzas',
  'Datos',
  'Administración',
];

export function hasAnyPermission(granted: readonly string[], required: readonly string[] | null): boolean {
  if (required === null) return true;
  if (required.length === 0) return false;
  return granted.includes('*') || required.some((permission) => granted.includes(permission));
}

function pathMatches(path: string, basePath: string): boolean {
  return path === basePath || path.startsWith(`${basePath}/`);
}

/** Finds an exact route, or the most specific registered parent for nested routes. */
export function getRouteDefinition(path: string): RouteDefinition | undefined {
  return ROUTE_DEFINITIONS.find((route) => route.path === path)
    ?? ROUTE_DEFINITIONS
      .filter((route) => pathMatches(path, route.path))
      .sort((a, b) => b.path.length - a.path.length)[0];
}

export function canAccessRoute(path: string, granted: readonly string[]): boolean {
  const route = getRouteDefinition(path);
  return !route || hasAnyPermission(granted, route.requiredAnyPermissions);
}

export function isRouteActive(currentPath: string, targetPath: string): boolean {
  return pathMatches(currentPath, targetPath);
}

export function getVisibleNavigationGroups(granted: readonly string[]) {
  return SIDEBAR_SECTIONS.map((section) => ({
    title: section,
    items: ROUTE_DEFINITIONS.filter((route) =>
      route.section === section && route.sidebar && hasAnyPermission(granted, route.requiredAnyPermissions),
    ),
  })).filter((group) => group.items.length > 0);
}

export function getCommandRoutes(granted: readonly string[]): readonly RouteDefinition[] {
  return ROUTE_DEFINITIONS.filter((route) =>
    route.command && hasAnyPermission(granted, route.requiredAnyPermissions),
  );
}

export function getBreadcrumbLabels(path: string): string[] {
  const route = getRouteDefinition(path);
  if (!route || route.path === '/dashboard') return ['Inicio', ...(route ? [route.title] : [])];
  return ['Inicio', ...(route.section === 'Inicio' ? [] : [route.section]), route.title];
}

export function getAuthRedirectTarget(path: string, authenticated: boolean): string | null {
  if (!authenticated && !['/login', '/register'].includes(path)) return '/login';
  if (authenticated && (path === '/' || path === '/login' || path === '/register')) return '/dashboard';
  return null;
}

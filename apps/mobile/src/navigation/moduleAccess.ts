export type MobileModuleRoute =
  | 'Inventory'
  | 'Purchasing'
  | 'Production'
  | 'Maintenance'
  | 'HR'
  | 'Finance';

export interface ModuleNavigationItem {
  key: string;
  route: MobileModuleRoute;
  title: string;
  detail: string;
  icon: 'inventory' | 'purchasing' | 'production' | 'maintenance' | 'hr' | 'finance';
  section: 'Operaciones' | 'Personas' | 'Finanzas';
  requiredAnyPermissions: readonly string[];
}

/** Permission names match the backend identity catalog; never persist grants locally. */
export const MODULE_ACCESS = {
  inventoryRead: ['inventory.read'],
  inventoryWrite: ['inventory.create', 'inventory.update'],
  inventoryCreate: ['inventory.create'],
  inventoryUpdate: ['inventory.update'],
  inventoryDelete: ['inventory.delete'],
  inventoryMove: ['inventory.stock.in', 'inventory.stock.out', 'inventory.stock.adjust', 'inventory.transfer'],
  purchasingRead: ['purchasing.read'],
  purchasingWrite: ['purchasing.create', 'purchasing.update'],
  purchasingReceive: ['purchasing.receive'],
  productionRead: ['production.read'],
  productionWrite: ['production.create', 'production.update'],
  maintenanceRead: ['maintenance.read'],
  maintenanceWrite: ['maintenance.create', 'maintenance.update'],
  hrRead: ['hr.read.team'],
  hrTimeOffRead: ['hr.read.self', 'hr.read.team'],
  hrWrite: ['hr.write', 'hr.write.self'],
  financeRead: ['finance.read'],
  financeWrite: ['finance.create', 'finance.update'],
} as const;

export const MOBILE_MODULES: readonly ModuleNavigationItem[] = [
  { key: 'inventory', route: 'Inventory', title: 'Inventario', detail: 'Productos, existencias y almacenes', icon: 'inventory', section: 'Operaciones', requiredAnyPermissions: MODULE_ACCESS.inventoryRead },
  { key: 'purchasing', route: 'Purchasing', title: 'Compras', detail: 'Órdenes y proveedores', icon: 'purchasing', section: 'Operaciones', requiredAnyPermissions: MODULE_ACCESS.purchasingRead },
  { key: 'production', route: 'Production', title: 'Producción', detail: 'Órdenes y avance', icon: 'production', section: 'Operaciones', requiredAnyPermissions: MODULE_ACCESS.productionRead },
  { key: 'maintenance', route: 'Maintenance', title: 'Mantenimiento', detail: 'Órdenes y equipos', icon: 'maintenance', section: 'Operaciones', requiredAnyPermissions: MODULE_ACCESS.maintenanceRead },
  { key: 'hr', route: 'HR', title: 'Recursos Humanos', detail: 'Empleados y permisos', icon: 'hr', section: 'Personas', requiredAnyPermissions: MODULE_ACCESS.hrRead },
  { key: 'finance', route: 'Finance', title: 'Finanzas', detail: 'Movimientos y cuentas', icon: 'finance', section: 'Finanzas', requiredAnyPermissions: MODULE_ACCESS.financeRead },
];

export function hasAnyPermission(granted: readonly string[], required: readonly string[]): boolean {
  return granted.includes('*') || required.some((permission) => granted.includes(permission));
}

export function getVisibleModules(granted: readonly string[]): readonly ModuleNavigationItem[] {
  return MOBILE_MODULES.filter((module) => hasAnyPermission(granted, module.requiredAnyPermissions));
}

export function getVisibleModulesForSection(
  granted: readonly string[],
  section: ModuleNavigationItem['section'],
): readonly ModuleNavigationItem[] {
  return getVisibleModules(granted).filter((module) => module.section === section);
}

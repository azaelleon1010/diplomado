import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { TramaTechLogo } from './TramaTechLogo';
import { SidebarGroup } from './SidebarGroup';
import { sidebar } from '../theme/tokens';

interface NavItem {
  label: string;
  path: string;
  icon?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
  defaultExpanded?: boolean;
}

const navStructure: NavGroup[] = [
  {
    title: 'INICIO',
    items: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Mi trabajo', path: '/mywork' },
    ],
    defaultExpanded: true,
  },
  {
    title: 'OPERACIONES',
    items: [
      { label: 'Producción', path: '/operations/production' },
      { label: 'Inventario', path: '/operations/inventory' },
      { label: 'Almacenes', path: '/operations/warehouses' },
      { label: 'Mantenimiento', path: '/operations/maintenance' },
      { label: 'Calidad', path: '/operations/quality' },
    ],
  },
  {
    title: 'ABASTECIMIENTO',
    items: [
      { label: 'Compras', path: '/procurement/purchases' },
      { label: 'Proveedores', path: '/procurement/suppliers' },
      { label: 'Recepción', path: '/procurement/receiving' },
    ],
  },
  {
    title: 'COMERCIAL',
    items: [
      { label: 'Clientes', path: '/sales/customers' },
      { label: 'Ventas', path: '/sales/orders' },
      { label: 'Pedidos', path: '/sales/orders' },
    ],
  },
  {
    title: 'FINANZAS',
    items: [
      { label: 'Contabilidad', path: '/finance/accounting' },
      { label: 'Cuentas por cobrar', path: '/finance/receivables' },
      { label: 'Cuentas por pagar', path: '/finance/payables' },
      { label: 'Tesorería', path: '/finance/treasury' },
    ],
  },
  {
    title: 'PERSONAS',
    items: [
      { label: 'Empleados', path: '/people/employees' },
      { label: 'Asistencia', path: '/people/attendance' },
      { label: 'Vacaciones', path: '/people/vacations' },
    ],
  },
  {
    title: 'DATOS',
    items: [
      { label: 'Productos', path: '/master-data/products' },
      { label: 'Materiales', path: '/master-data/materials' },
      { label: 'Maquinaria', path: '/master-data/machines' },
    ],
  },
  {
    title: 'ANALÍTICA',
    items: [
      { label: 'KPIs', path: '/analytics/kpis' },
      { label: 'Reportes', path: '/analytics/reports' },
    ],
  },
  {
    title: 'ADMINISTRACIÓN',
    items: [
      { label: 'Usuarios', path: '/administration/users' },
      { label: 'Roles y permisos', path: '/administration/roles' },
      { label: 'Configuración', path: '/administration/settings' },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Sidebar({ collapsed, onToggle, currentPath, onNavigate }: SidebarProps) {
  const t = useTheme();
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    new Set(navStructure.filter((g) => g.defaultExpanded).map((g) => g.title))
  );

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <View
      style={[
        styles.sidebar,
        { width: collapsed ? t.sidebar.collapsed : t.sidebar.expanded },
      ]}
    >
      <View style={styles.logoContainer}>
        <TramaTechLogo collapsed={collapsed} />
      </View>

      <TouchableOpacity style={styles.toggleButton} onPress={onToggle} accessibilityLabel="Toggle sidebar">
        <Text style={styles.toggleText}>{collapsed ? '◀' : '▶'}</Text>
      </TouchableOpacity>

      <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
        {navStructure.map((group) => (
          <SidebarGroup
            key={group.title}
            title={group.title}
            expanded={expandedGroups.has(group.title)}
            onToggle={() => toggleGroup(group.title)}
            collapsed={collapsed}
          >
            {group.items.map((item) => (
              <TouchableOpacity
                key={item.path}
                style={[
                  styles.navItem,
                  currentPath === item.path && styles.navItemActive,
                ]}
                onPress={() => onNavigate(item.path)}
                accessible
                accessibilityLabel={item.label}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.navItemText,
                    currentPath === item.path && styles.navItemTextActive,
                    collapsed && styles.navItemTextCollapsed,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {currentPath === item.path && !collapsed && (
                  <View style={styles.activeIndicator} />
                )}
              </TouchableOpacity>
            ))}
          </SidebarGroup>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: '#0B0F1A',
    borderRightWidth: 1,
    borderRightColor: '#1F2937',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    transition: 'width 0.2s ease',
  },
  logoContainer: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937',
  },
  toggleButton: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  toggleText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  navList: {
    flex: 1,
    paddingVertical: 8,
  },
  navItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  navItemActive: {
    backgroundColor: '#0047AB20',
    borderLeftWidth: 3,
    borderLeftColor: '#0047AB',
  },
  navItemText: {
    color: '#94A3B8',
    fontSize: 13,
    flex: 1,
  },
  navItemTextActive: {
    color: '#F1F5F9',
    fontWeight: '600',
  },
  navItemTextCollapsed: {
    fontSize: 0,
    opacity: 0,
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00FFCC',
    marginLeft: 8,
  },
});

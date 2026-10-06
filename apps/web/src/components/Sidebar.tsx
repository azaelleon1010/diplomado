import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { TramaTechLogo } from './TramaTechLogo';
import { SidebarGroup } from './SidebarGroup';
import { getVisibleNavigationGroups, isRouteActive } from '../navigation/registry';

interface SidebarProps {
  collapsed: boolean;
  mobile?: boolean;
  permissions: readonly string[];
  currentPath: string;
  onToggle: () => void;
  onNavigate: (path: string) => void;
}

export function Sidebar({
  collapsed,
  mobile = false,
  permissions,
  currentPath,
  onToggle,
  onNavigate,
}: SidebarProps): React.JSX.Element {
  const { semanticColors: color, sidebar } = useTheme();
  const groups = getVisibleNavigationGroups(permissions);
  const activeGroup = groups.find((group) => group.items.some((route) => isRouteActive(currentPath, route.path)))?.title;
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    () => new Set(activeGroup ? [activeGroup] : ['Inicio']),
  );

  React.useEffect(() => {
    if (activeGroup) {
      setExpandedGroups((previous) => new Set(previous).add(activeGroup));
    }
  }, [activeGroup]);

  const toggleGroup = (title: string) => {
    setExpandedGroups((previous) => {
      const next = new Set(previous);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <View
      accessibilityRole="navigation"
      accessibilityLabel="Navegación principal"
      style={[
        styles.sidebar,
        { width: collapsed ? sidebar.collapsed : sidebar.expanded, backgroundColor: color.background, borderRightColor: color.border },
        mobile && styles.mobileSidebar,
      ]}>
      <View style={[styles.logoContainer, { borderBottomColor: color.border }]}>
        <TramaTechLogo collapsed={collapsed} />
        {mobile ? (
          <TouchableOpacity
            onPress={onToggle}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú de navegación">
            <Text style={[styles.closeText, { color: color.textSecondary }]}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {!mobile ? (
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? 'Expandir menú de navegación' : 'Colapsar menú de navegación'}>
          <Text style={[styles.toggleText, { color: color.textSecondary }]}>{collapsed ? '›' : '‹'}</Text>
        </TouchableOpacity>
      ) : null}

      <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
        {groups.map((group) => (
          <SidebarGroup
            key={group.title}
            title={group.title}
            expanded={expandedGroups.has(group.title)}
            onToggle={() => toggleGroup(group.title)}
            collapsed={collapsed}>
            {group.items.map((item) => {
              const active = isRouteActive(currentPath, item.path);
              return (
                <TouchableOpacity
                  key={item.path}
                  style={[
                    styles.navItem,
                    { borderLeftColor: active ? color.secondary : 'transparent' },
                    active && { backgroundColor: color.neutralSoft },
                    collapsed && styles.navItemCollapsed,
                  ]}
                  onPress={() => onNavigate(item.path)}
                  title={collapsed ? item.title : undefined}
                  accessibilityLabel={item.title}
                  accessibilityHint={collapsed ? `Abrir ${item.title}` : undefined}
                  accessibilityState={{ selected: active }}
                  accessibilityRole="button">
                  <Text style={[styles.navIcon, { color: active ? color.secondary : color.textSecondary }]} aria-hidden>
                    {item.icon}
                  </Text>
                  {!collapsed ? (
                    <Text
                      style={[styles.navItemText, { color: active ? color.textPrimary : color.textSecondary }]}
                      numberOfLines={1}>
                      {item.title}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </SidebarGroup>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flexShrink: 0,
    flexDirection: 'column',
    overflow: 'hidden',
    borderRightWidth: 1,
    zIndex: 100,
  },
  mobileSidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 151,
    elevation: 8,
  },
  logoContainer: {
    minHeight: 64,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  closeButton: { position: 'absolute', right: 8, top: 14, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 26, lineHeight: 30 },
  toggleButton: { height: 36, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 18 },
  toggleText: { fontSize: 22, lineHeight: 28 },
  navList: { flex: 1, paddingVertical: 8 },
  navItem: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderLeftWidth: 3,
  },
  navItemCollapsed: { justifyContent: 'center', paddingHorizontal: 8 },
  navIcon: { width: 20, textAlign: 'center', fontSize: 17, lineHeight: 22 },
  navItemText: { flex: 1, fontSize: 13, lineHeight: 18 },
});

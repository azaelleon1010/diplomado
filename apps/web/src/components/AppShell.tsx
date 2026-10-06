import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native-web';
import { breakpoints, colors } from '../theme/tokens';
import { useTheme } from '../theme/Theme';
import { getBreadcrumbLabels, getRouteDefinition } from '../navigation/registry';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  children: React.ReactNode;
  currentPath: string;
  permissions: readonly string[];
  userName: string;
  email: string;
  tenantName: string;
  onNavigate: (path: string) => void;
  onOpenCommandPalette: () => void;
  onLogout: () => void;
}

function currentViewportWidth(): number {
  return typeof window === 'undefined' ? breakpoints.desktop : window.innerWidth;
}

export function AppShell({
  children,
  currentPath,
  permissions,
  userName,
  email,
  tenantName,
  onNavigate,
  onOpenCommandPalette,
  onLogout,
}: AppShellProps): React.JSX.Element {
  const { semanticColors: color } = useTheme();
  const [viewportWidth, setViewportWidth] = useState(currentViewportWidth);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tabletExpanded, setTabletExpanded] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const updateWidth = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const mobile = viewportWidth < breakpoints.mobile;
  const tablet = viewportWidth >= breakpoints.mobile && viewportWidth < breakpoints.desktop;
  const compact = tablet ? !tabletExpanded : sidebarCollapsed;
  const route = getRouteDefinition(currentPath);
  const title = route?.title ?? 'Ruta no encontrada';
  const breadcrumbs = getBreadcrumbLabels(currentPath);

  useEffect(() => {
    if (!mobile) setMobileDrawerOpen(false);
  }, [mobile]);

  const toggleSidebar = useCallback(() => {
    if (mobile) {
      setMobileDrawerOpen((open) => !open);
    } else if (tablet) {
      setTabletExpanded((expanded) => !expanded);
    } else {
      setSidebarCollapsed((collapsed) => !collapsed);
    }
  }, [mobile, tablet]);

  const handleNavigate = useCallback((path: string) => {
    setMobileDrawerOpen(false);
    onNavigate(path);
  }, [onNavigate]);

  return (
    <View style={[styles.container, { backgroundColor: color.background }]}>
      {!mobile ? (
        <Sidebar
          collapsed={compact}
          permissions={permissions}
          currentPath={currentPath}
          onToggle={toggleSidebar}
          onNavigate={handleNavigate}
        />
      ) : null}
      <View style={styles.main}>
        <TopBar
          title={title}
          breadcrumbs={breadcrumbs}
          mobile={mobile}
          userName={userName}
          email={email}
          tenantName={tenantName}
          onToggleSidebar={toggleSidebar}
          onOpenCommandPalette={onOpenCommandPalette}
          onLogout={onLogout}
        />
        <View style={styles.content}>{children}</View>
      </View>

      {mobile && mobileDrawerOpen ? (
        <View style={styles.drawerLayer}>
          <TouchableOpacity
            style={[styles.drawerOverlay, { backgroundColor: colors.surface.overlay }]}
            onPress={() => setMobileDrawerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú de navegación" />
          <Sidebar
            collapsed={false}
            mobile
            permissions={permissions}
            currentPath={currentPath}
            onToggle={() => setMobileDrawerOpen(false)}
            onNavigate={handleNavigate}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', height: '100%', minWidth: 0, position: 'relative' },
  main: { flex: 1, flexDirection: 'column', minWidth: 0, minHeight: 0 },
  content: { flex: 1, minHeight: 0, overflow: 'auto' },
  drawerLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 150 },
  drawerOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});

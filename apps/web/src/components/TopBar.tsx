import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';

interface TopBarProps {
  title: string;
  breadcrumbs: readonly string[];
  mobile: boolean;
  userName: string;
  email: string;
  tenantName: string;
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
  onLogout: () => void;
}

export function TopBar({
  title,
  breadcrumbs,
  mobile,
  userName,
  email,
  tenantName,
  onToggleSidebar,
  onOpenCommandPalette,
  onLogout,
}: TopBarProps): React.JSX.Element {
  const { semanticColors: color } = useTheme();

  return (
    <View style={[styles.topBar, mobile && styles.topBarMobile, { backgroundColor: color.inputSurface, borderBottomColor: color.border }]}>
      <View style={[styles.left, mobile && styles.leftMobile]}>
        <TouchableOpacity
          onPress={onToggleSidebar}
          style={styles.menuButton}
          accessibilityRole="button"
          accessibilityLabel={mobile ? 'Abrir menú de navegación' : 'Cambiar tamaño del menú de navegación'}>
          <Text style={[styles.menuIcon, { color: color.textSecondary }]}>☰</Text>
        </TouchableOpacity>
        <View style={[styles.pageContext, mobile && styles.pageContextMobile]}>
          <View accessibilityRole="navigation" accessibilityLabel="Ruta de navegación" style={[styles.breadcrumbs, mobile && styles.breadcrumbsMobile]}>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={`${crumb}-${index}`}>
                {index > 0 ? <Text style={[styles.separator, { color: color.textMuted }]}>/</Text> : null}
                <Text
                  accessibilityRole={index === breadcrumbs.length - 1 ? 'text' : undefined}
                  aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                  style={[
                    styles.breadcrumb,
                    { color: index === breadcrumbs.length - 1 ? color.textSecondary : color.textMuted },
                  ]}>
                  {crumb}
                </Text>
              </React.Fragment>
            ))}
          </View>
          <Text accessibilityRole="header" style={[styles.pageTitle, mobile && styles.pageTitleMobile, { color: color.textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </View>

      <View style={[styles.right, mobile && styles.rightMobile]}>
        <TouchableOpacity
          onPress={onOpenCommandPalette}
          style={[styles.commandButton, mobile && styles.commandButtonMobile, { borderColor: color.borderStrong, backgroundColor: color.surface }]}
          accessibilityRole="button"
          accessibilityLabel="Abrir paleta de comandos">
          <Text style={[styles.commandText, { color: color.textSecondary }]}>⌕{mobile ? '' : ' Buscar'}</Text>
          {!mobile ? <Text style={[styles.shortcut, { color: color.textMuted }]}>Ctrl K</Text> : null}
        </TouchableOpacity>
        <View style={[styles.identity, mobile && styles.identityMobile]}>
          <Text style={[styles.userName, { color: color.textPrimary }]} numberOfLines={1}>{userName}</Text>
          <Text style={[styles.tenant, { color: color.textSecondary }]} numberOfLines={1}>{tenantName}</Text>
          {!mobile ? <Text style={[styles.email, { color: color.textMuted }]} numberOfLines={1}>{email}</Text> : null}
        </View>
        {!mobile ? (
          <View style={[styles.sessionStatus, { backgroundColor: color.successSoft }]}>
            <View style={[styles.statusDot, { backgroundColor: color.success }]} />
            <Text style={[styles.sessionText, { color: color.success }]}>Sesión activa</Text>
          </View>
        ) : null}
        <TouchableOpacity
          onPress={onLogout}
          style={[styles.logoutButton, { borderColor: color.borderStrong }]}
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión">
          <Text style={[styles.logoutText, { color: color.textPrimary }]}>{mobile ? 'Salir' : 'Cerrar sesión'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 72,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
    zIndex: 90,
  },
  topBarMobile: { minHeight: 64, paddingHorizontal: 6, gap: 4 },
  left: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  leftMobile: { gap: 2 },
  pageContext: { minWidth: 0, gap: 1 },
  pageContextMobile: { flex: 1 },
  breadcrumbs: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breadcrumbsMobile: { display: 'none' },
  breadcrumb: { fontSize: 11, lineHeight: 15 },
  separator: { fontSize: 11, lineHeight: 15 },
  pageTitle: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  pageTitleMobile: { fontSize: 14, lineHeight: 19 },
  menuButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 20, lineHeight: 24 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rightMobile: { gap: 4 },
  commandButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderWidth: 1, borderRadius: 8 },
  commandButtonMobile: { minWidth: 40, paddingHorizontal: 8, justifyContent: 'center' },
  commandText: { fontSize: 13, lineHeight: 18 },
  shortcut: { fontSize: 10, lineHeight: 14 },
  identity: { maxWidth: 180, alignItems: 'flex-end' },
  identityMobile: { maxWidth: 80 },
  userName: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  tenant: { fontSize: 11, lineHeight: 15 },
  email: { fontSize: 10, lineHeight: 14 },
  sessionStatus: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  sessionText: { fontSize: 10, fontWeight: '600', lineHeight: 14 },
  logoutButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  logoutText: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
});

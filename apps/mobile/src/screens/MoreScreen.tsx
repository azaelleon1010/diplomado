import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { Avatar } from '../components/Avatar';
import { unreadAlertsCount } from '../data/alerts';
import { Text } from 'react-native';
import { getVisibleModules, getVisibleModulesForSection } from '../navigation/moduleAccess';
import { EmptyState } from '../components/States';

export function MoreScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName, user, me, tenant, signOut } = useAuth();
  const navigation = useAppNavigation();
  const modules = getVisibleModules(me?.permissions ?? []);
  const moduleGroups = (['Operaciones', 'Personas', 'Finanzas'] as const)
    .map((section) => ({ section, items: getVisibleModulesForSection(me?.permissions ?? [], section) }))
    .filter((group) => group.items.length > 0);
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || userName;
  const tenantId = me?.membership.tenantId ?? user?.tenantId ?? 'No disponible';

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Más"
        subtitle="Módulos y cuenta"
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Perfil" />
        <Card>
          <View style={styles.profileRow}>
            <Avatar name={fullName} size={52} />
            <View style={styles.profileText}>
              <Text style={[styles.profileName, { color: palette.textPrimary }]}>{fullName}</Text>
              <Text style={[styles.profileRole, { color: palette.textSecondary }]}>
                {user?.email ?? 'Correo no disponible'}
              </Text>
              {tenant ? (
                <>
                  <Text style={[styles.profileRole, { color: palette.textSecondary }]}>
                    Empresa: {tenant.name}
                  </Text>
                  <Text style={[styles.profileRole, { color: palette.textSecondary }]}>
                    Identificador de acceso: {tenant.slug}
                  </Text>
                </>
              ) : (
                <Text style={[styles.profileRole, { color: palette.textSecondary }]}>
                  Tenant: {tenantId}
                </Text>
              )}
            </View>
          </View>
        </Card>

        <SectionHeader title="Módulos disponibles" />
        {moduleGroups.map((group) => (
          <React.Fragment key={group.section}>
            <SectionHeader title={group.section} />
            <Card style={styles.listCard}>
              {group.items.map((m) => (
                <ListItem
                  key={m.key}
                  title={m.title}
                  subtitle={m.detail}
                  icon={m.icon}
                  showChevron
                  onPress={() => navigation.navigate('Operations', { screen: m.route } as never)}
                />
              ))}
            </Card>
          </React.Fragment>
        ))}
        {modules.length === 0 ? (
          <Card style={styles.listCard}>
            <EmptyState title="Sin módulos disponibles" detail="Los módulos aparecen aquí según los permisos de tu sesión." />
          </Card>
        ) : null}

        <SectionHeader title="Cuenta" />
        <Card style={styles.listCard}>
          <ListItem
            title="Configuración"
            subtitle="Preferencias de la app"
            icon="settings"
            showChevron
            onPress={() => navigation.navigate('Settings')}
          />
          <ListItem
            title="Acerca de TramaTech"
            subtitle="Versión y entorno"
            icon="info"
            showChevron
            onPress={() => navigation.navigate('About')}
          />
          <ListItem title="Cerrar sesión" subtitle="Salir de esta sesión" icon="logout" onPress={() => { void signOut(); }} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileText: { flex: 1 },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
  },
  profileRole: {
    fontSize: 12,
    marginTop: 2,
  },
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

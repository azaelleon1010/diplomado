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
import { type IconName } from '../components/Icon';
import { Text } from 'react-native';

const MODULE_ROUTES = [
  { title: 'Inventario', detail: 'Materiales y almacenes', icon: 'inventory', target: 'Inventory' },
  { title: 'Mantenimiento', detail: 'Incidencias y equipos', icon: 'maintenance', target: 'Maintenance' },
  { title: 'Producción', detail: 'Órdenes y avance', icon: 'production', target: 'Production' },
  { title: 'Compras', detail: 'Órdenes y proveedores', icon: 'purchasing', target: 'Purchasing' },
  { title: 'Recursos Humanos', detail: 'Turnos y vacaciones', icon: 'hr', target: 'HR' },
  { title: 'Finanzas', detail: 'Resumen inicial', icon: 'finance', target: 'Finance' },
] as const;

export function MoreScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName, signOut } = useAuth();
  const navigation = useAppNavigation();

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
        <Card>
          <View style={styles.profileRow}>
            <Avatar name={userName} size={52} />
            <View style={styles.profileText}>
              <Text style={[styles.profileName, { color: palette.textPrimary }]}>{userName}</Text>
              <Text style={[styles.profileRole, { color: palette.textSecondary }]}>
                Supervisor de planta · Planta MX-01
              </Text>
            </View>
          </View>
        </Card>

        <SectionHeader title="Módulos" />
        <Card style={styles.listCard}>
          {MODULE_ROUTES.map((m) => (
            <ListItem
              key={m.target}
              title={m.title}
              subtitle={m.detail}
              icon={m.icon as IconName}
              showChevron
              onPress={() => navigation.navigate('Operations', { screen: m.target } as never)}
            />
          ))}
        </Card>

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
          <ListItem title="Cerrar sesión" subtitle="Volver al login (mock)" icon="logout" onPress={signOut} />
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

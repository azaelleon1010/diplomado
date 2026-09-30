import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { unreadAlertsCount } from '../data/alerts';
import { type IconName } from '../components/Icon';
import type { OperationsStackParamList } from '../navigation/types';

const MODULES: ReadonlyArray<{
  route: keyof OperationsStackParamList;
  title: string;
  detail: string;
  icon: IconName;
}> = [
  { route: 'Production', title: 'Producción', detail: 'Órdenes, avance y máquinas', icon: 'production' },
  { route: 'Inventory', title: 'Inventario', detail: 'Materiales, stock y almacenes', icon: 'inventory' },
  { route: 'Maintenance', title: 'Mantenimiento', detail: 'Incidencias y equipos', icon: 'maintenance' },
  { route: 'Purchasing', title: 'Compras', detail: 'Órdenes y proveedores', icon: 'purchasing' },
];

export function OperationsHubScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Operaciones"
        subtitle="Módulos de planta"
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.listCard}>
          {MODULES.map((m) => (
            <ListItem
              key={m.route}
              title={m.title}
              subtitle={m.detail}
              icon={m.icon}
              showChevron
              onPress={() => navigation.navigate('Operations', { screen: m.route } as never)}
            />
          ))}
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
  },
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

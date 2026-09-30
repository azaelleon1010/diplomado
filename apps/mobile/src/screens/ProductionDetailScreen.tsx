import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge } from '../components/StatusBadge';
import { Card } from '../components/Card';
import { ListItem } from '../components/ListItem';
import { EmptyState } from '../components/States';
import { unreadAlertsCount } from '../data/alerts';
import { productionOrders } from '../data/production';
import type { RootStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<RootStackParamList, 'ProductionDetail'>;

export function ProductionDetailScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const route = useRoute<DetailRoute>();
  const order = productionOrders.find((o) => o.id === route.params.orderId);

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title={order !== undefined ? `Orden #${order.id.replace('p-', '')}` : 'Orden'}
        subtitle="Detalle de producción"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      {order === undefined ? (
        <EmptyState title="Orden no encontrada" detail="El identificador no existe en datos mock." />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.headerRow}>
              <Text style={[styles.product, { color: palette.textPrimary }]}>{order.product}</Text>
              <StatusBadge
                label={
                  order.status === 'in_process'
                    ? 'En proceso'
                    : order.status === 'queued'
                      ? 'En cola'
                      : order.status === 'completed'
                        ? 'Completada'
                        : 'Pausada'
                }
                tone={
                  order.status === 'completed'
                    ? 'success'
                    : order.status === 'paused'
                      ? 'warning'
                      : 'info'
                }
              />
            </View>
            <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
              Progreso · {order.progress}%
            </Text>
            <View style={[styles.track, { backgroundColor: palette.backgroundSecondary }]}>
              <View
                style={[styles.fill, { width: `${order.progress}%`, backgroundColor: palette.accent }]}
              />
            </View>
          </Card>

          <SectionHeader title="Asignación" />
          <Card style={styles.listCard}>
            <ListItem title="Máquina" subtitle={order.machine} icon="production" />
            <ListItem title="Responsable" subtitle={order.owner} icon="hr" />
          </Card>

          <SectionHeader title="Trazabilidad (mock)" />
          <Card style={styles.listCard}>
            <ListItem title="Material" subtitle="Tela sintética TS-204 · Almacén B" icon="inventory" />
            <ListItem title="Calidad" subtitle="Inspección aprobada · Lote L-88" icon="check" />
          </Card>
        </ScrollView>
      )}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  product: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    flex: 1,
  },
  progressLabel: {
    fontSize: typography.bodySmall.fontSize,
    marginTop: spacing.md,
  },
  track: {
    height: 10,
    borderRadius: radii.full,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  fill: {
    height: 10,
    borderRadius: radii.full,
  },
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

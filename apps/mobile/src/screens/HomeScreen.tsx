import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { MetricCard } from '../components/MetricCard';
import { SectionHeader } from '../components/SectionHeader';
import { ListItem } from '../components/ListItem';
import { StatusBadge } from '../components/StatusBadge';
import { Card } from '../components/Card';
import {
  currentUser,
  dashboardMetrics,
  recentActivity,
  recentOrders,
  systemStatus,
} from '../data/dashboard';
import { unreadAlertsCount } from '../data/alerts';

const MODULE_ICON = { production: 'production', maintenance: 'maintenance', inventory: 'inventory' } as const;

export function HomeScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const unread = unreadAlertsCount();

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title={`${currentUser.greeting}, ${userName.split(' ')[0]}`}
        subtitle={`${currentUser.role} · ${systemStatus.detail}`}
        unreadAlerts={unread}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: palette.success }]} />
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusLabel, { color: palette.textPrimary }]}>
                {systemStatus.label}
              </Text>
              <Text style={[styles.statusDetail, { color: palette.textSecondary }]}>
                {systemStatus.detail}
              </Text>
            </View>
            <StatusBadge label="En línea" tone="success" />
          </View>
        </Card>

        <SectionHeader title="Indicadores" />
        <View style={styles.metrics}>
          {dashboardMetrics.map((m) => (
            <MetricCard key={m.id} metric={m} />
          ))}
        </View>

        <SectionHeader
          title="Órdenes recientes"
          actionLabel="Ver producción"
          onAction={() => navigation.navigate('Operations', { screen: 'Production' } as never)}
        />
        <Card style={styles.listCard}>
          {recentOrders.map((o) => (
            <ListItem
              key={o.id}
              title={o.title}
              subtitle={o.detail}
              icon={MODULE_ICON[o.module]}
              badgeLabel={o.statusLabel}
              badgeTone={o.statusTone}
              showChevron
              onPress={
                o.module === 'production'
                  ? () => navigation.navigate('ProductionDetail', { orderId: 'p-104' })
                  : o.module === 'maintenance'
                    ? () => navigation.navigate('Operations', { screen: 'Maintenance' } as never)
                    : () => navigation.navigate('Operations', { screen: 'Inventory' } as never)
              }
            />
          ))}
        </Card>

        <SectionHeader title="Actividad reciente" />
        <Card style={styles.listCard}>
          {recentActivity.map((a) => (
            <ListItem key={a.id} title={a.title} subtitle={a.detail} rightText={a.time} />
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
    gap: spacing.lg,
  },
  statusCard: {
    padding: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusTextWrap: { flex: 1 },
  statusLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  statusDetail: {
    fontSize: typography.bodySmall.fontSize,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

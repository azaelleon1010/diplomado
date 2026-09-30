import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { Card } from '../components/Card';
import { Pressable } from 'react-native';
import { unreadAlertsCount } from '../data/alerts';
import { productionOrders } from '../data/production';
import type { OrderStatus } from '../types';

const STATUS_META: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  in_process: { label: 'En proceso', tone: 'info' },
  queued: { label: 'En cola', tone: 'neutral' },
  completed: { label: 'Completada', tone: 'success' },
  paused: { label: 'Pausada', tone: 'warning' },
};

export function ProductionScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Producción"
        subtitle="Órdenes y avance"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <View style={styles.body}>
        <SectionHeader title={`${productionOrders.length} órdenes`} />
        <FlatList
          data={productionOrders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status];
            return (
              <Pressable
                onPress={() => navigation.navigate('ProductionDetail', { orderId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${item.id}`}
                style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
                <Card>
                  <View style={styles.headerRow}>
                    <Text style={[styles.orderId, { color: palette.textPrimary }]}>
                      Orden #{item.id.replace('p-', '')}
                    </Text>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </View>
                  <Text style={[styles.product, { color: palette.textSecondary }]}>{item.product}</Text>
                  <View
                    style={[styles.track, { backgroundColor: palette.backgroundSecondary }]}>
                    <View
                      style={[styles.fill, { width: `${item.progress}%`, backgroundColor: palette.accent }]}
                    />
                  </View>
                  <View style={styles.footerRow}>
                    <Text style={[styles.footer, { color: palette.textMuted }]}>{item.progress}%</Text>
                    <Text style={[styles.footer, { color: palette.textMuted }]}>
                      {item.machine} · {item.owner}
                    </Text>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    flex: 1,
    padding: spacing.lg,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
  },
  product: {
    fontSize: typography.body.fontSize,
    marginTop: 2,
  },
  track: {
    height: 8,
    borderRadius: radii.full,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: radii.full,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  footer: {
    fontSize: typography.bodySmall.fontSize,
  },
});

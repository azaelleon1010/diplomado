import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { unreadAlertsCount } from '../data/alerts';
import {
  friendlyMessage,
  inventoryApi,
  loadSession,
  productionApi,
  type Product,
  type ProductionOrder,
} from '../lib/api';

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  RELEASED: { label: 'Liberada', tone: 'info' },
  IN_PROGRESS: { label: 'En proceso', tone: 'info' },
  PAUSED: { label: 'Pausada', tone: 'warning' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

const STATUS_FILTERS = [
  { id: 'IN_PROGRESS', label: 'En proceso' },
  { id: 'RELEASED', label: 'Liberadas' },
  { id: 'COMPLETED', label: 'Completadas' },
  { id: 'all', label: 'Todas' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['id'];

export function ProductionScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('IN_PROGRESS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await loadSession();
      if (!session?.accessToken) {
        setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
        setOrders([]);
        return;
      }
      const [fetched, catalog] = await Promise.all([
        productionApi.listOrders(session.accessToken, {
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: 100,
        }),
        inventoryApi.listProducts(session.accessToken, { limit: 100 }).catch(() => [] as Product[]),
      ]);
      setOrders(Array.isArray(fetched) ? fetched : []);
      const names: Record<string, string> = {};
      for (const product of Array.isArray(catalog) ? catalog : []) {
        names[product._id] = `${product.sku} · ${product.name}`;
      }
      setProductNames(names);
    } catch (err) {
      setOrders([]);
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const progressOf = (order: ProductionOrder): number => {
    if (order.quantity <= 0) return 0;
    return Math.min(100, Math.round((order.producedQuantity / order.quantity) * 100));
  };

  const renderContent = () => {
    if (loading && orders.length === 0) {
      return <LoadingState label="Cargando órdenes…" />;
    }
    if (error && orders.length === 0) {
      return (
        <ErrorState
          title="No se pudo cargar producción"
          detail={error}
          onRetry={() => void loadData()}
        />
      );
    }
    if (orders.length === 0) {
      return <EmptyState title="Sin órdenes" detail="No hay órdenes de producción en este estado." />;
    }
    return (
      <FlatList
        data={orders}
        keyExtractor={(o) => o._id}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] ?? { label: item.status, tone: 'neutral' as BadgeTone };
          const progress = progressOf(item);
          return (
            <Pressable
              onPress={() => navigation.navigate('ProductionDetail', { orderId: item._id })}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${item.code}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
              <Card>
                <View style={styles.headerRow}>
                  <Text style={[styles.orderId, { color: palette.textPrimary }]}>Orden #{item.code}</Text>
                  <StatusBadge label={meta.label} tone={meta.tone} />
                </View>
                <Text style={[styles.product, { color: palette.textSecondary }]}>
                  {productNames[item.productId] ?? 'Producto'}
                </Text>
                <View style={[styles.track, { backgroundColor: palette.backgroundSecondary }]}>
                  <View style={[styles.fill, { width: `${progress}%`, backgroundColor: palette.accent }]} />
                </View>
                <View style={styles.footerRow}>
                  <Text style={[styles.footer, { color: palette.textMuted }]}>
                    {item.producedQuantity}/{item.quantity} · {progress}%
                  </Text>
                  <Text style={[styles.footer, { color: palette.textMuted }]}>
                    {[item.machine, item.responsible].filter(Boolean).join(' · ') || 'Sin asignar'}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    );
  };

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
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: palette.brand }]}
          onPress={() => navigation.navigate('ProductionOrderForm')}
          accessibilityRole="button"
          accessibilityLabel="Nueva orden de producción">
          <Text style={styles.addButtonText}>+ Nueva orden</Text>
        </TouchableOpacity>
        <FlatList
          data={[...STATUS_FILTERS]}
          horizontal
          keyExtractor={(f) => f.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => (
            <Chip label={item.label} selected={statusFilter === item.id} onPress={() => setStatusFilter(item.id)} />
          )}
        />
        <SectionHeader title={`${orders.length} órdenes`} />
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
    flexGrow: 1,
  },
  addButton: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
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

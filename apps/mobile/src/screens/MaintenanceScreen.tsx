import React, { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { unreadAlertsCount } from '../data/alerts';
import {
  friendlyMessage,
  loadSession,
  maintenanceApi,
  type Asset,
  type MaintenanceOrder,
} from '../lib/api';

const PRIORITY_META: Record<string, { label: string; tone: BadgeTone }> = {
  LOW: { label: 'Prioridad baja', tone: 'info' },
  MEDIUM: { label: 'Prioridad media', tone: 'warning' },
  HIGH: { label: 'Prioridad alta', tone: 'danger' },
  CRITICAL: { label: 'Crítica', tone: 'danger' },
};

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Abierta', tone: 'warning' },
  IN_PROGRESS: { label: 'En curso', tone: 'info' },
  ON_HOLD: { label: 'En espera', tone: 'neutral' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

const STATUS_FILTERS = [
  { id: 'OPEN', label: 'Abiertas' },
  { id: 'IN_PROGRESS', label: 'En curso' },
  { id: 'COMPLETED', label: 'Completadas' },
  { id: 'all', label: 'Todas' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['id'];

export function MaintenanceScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetNames, setAssetNames] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
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
        setAssets([]);
        return;
      }
      const [fetchedOrders, fetchedAssets] = await Promise.all([
        maintenanceApi.listOrders(session.accessToken, {
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: 100,
        }),
        maintenanceApi.listAssets(session.accessToken).catch(() => [] as Asset[]),
      ]);
      setOrders(Array.isArray(fetchedOrders) ? fetchedOrders : []);
      const list = Array.isArray(fetchedAssets) ? fetchedAssets : [];
      setAssets(list);
      const names: Record<string, string> = {};
      for (const asset of list) names[asset._id] = `${asset.code} · ${asset.name}`;
      setAssetNames(names);
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

  const renderContent = () => {
    if (loading && orders.length === 0) {
      return <LoadingState label="Cargando mantenimiento…" />;
    }
    if (error && orders.length === 0) {
      return (
        <ErrorState
          title="No se pudo cargar mantenimiento"
          detail={error}
          onRetry={() => void loadData()}
        />
      );
    }
    if (orders.length === 0) {
      return (
        <EmptyState
          title="Sin órdenes"
          detail="No hay órdenes de mantenimiento en este estado."
        />
      );
    }
    return (
      <FlatList
        data={orders}
        keyExtractor={(o) => o._id}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const priority = PRIORITY_META[item.priority] ?? { label: item.priority, tone: 'neutral' as BadgeTone };
          const status = STATUS_META[item.status] ?? { label: item.status, tone: 'neutral' as BadgeTone };
          return (
            <Card style={styles.itemCard}>
              <ListItem
                title={item.title}
                subtitle={`${assetNames[item.assetId] ?? 'Activo'} · ${status.label}`}
                icon="maintenance"
                badgeLabel={priority.label}
                badgeTone={priority.tone}
                showChevron
                onPress={() => navigation.navigate('MaintenanceOrderDetail', { orderId: item._id })}
              />
            </Card>
          );
        }}
      />
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Mantenimiento"
        subtitle="Órdenes y equipos"
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
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: palette.brand }]}
            onPress={() => navigation.navigate('MaintenanceOrderForm')}
            accessibilityRole="button"
            accessibilityLabel="Nueva orden de mantenimiento">
            <Text style={styles.actionText}>+ Nueva orden</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: palette.surfaceSecondary, borderColor: palette.borderStrong, borderWidth: 1 }]}
            onPress={() => navigation.navigate('AssetForm')}
            accessibilityRole="button"
            accessibilityLabel="Nuevo activo">
            <Text style={[styles.actionText, { color: palette.textPrimary }]}>+ Nuevo activo</Text>
          </TouchableOpacity>
        </View>
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
        <SectionHeader title={`Equipos (${assets.length})`} />
        {assets.slice(0, 5).map((asset) => (
          <Card key={asset._id} style={styles.itemCard}>
            <ListItem
              title={`${asset.code} · ${asset.name}`}
              subtitle={`${asset.type}${asset.location ? ` · ${asset.location}` : ''}`}
              icon="maintenance"
              badgeLabel={asset.status === 'ACTIVE' ? 'Activo' : asset.status === 'IN_MAINTENANCE' ? 'En mantenimiento' : asset.status}
              badgeTone={asset.status === 'ACTIVE' ? 'success' : asset.status === 'IN_MAINTENANCE' ? 'warning' : 'neutral'}
            />
          </Card>
        ))}
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
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  itemCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

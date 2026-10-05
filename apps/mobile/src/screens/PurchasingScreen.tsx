import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
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
  purchasingApi,
  type PurchaseOrder,
  type Supplier,
} from '../lib/api';

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  SENT: { label: 'Enviada', tone: 'info' },
  APPROVED: { label: 'Aprobada', tone: 'info' },
  PARTIALLY_RECEIVED: { label: 'Parcial', tone: 'warning' },
  RECEIVED: { label: 'Recibida', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

const STATUS_FILTERS = [
  { id: 'DRAFT', label: 'Borradores' },
  { id: 'APPROVED', label: 'Aprobadas' },
  { id: 'RECEIVED', label: 'Recibidas' },
  { id: 'all', label: 'Todas' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['id'];

export function PurchasingScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierNames, setSupplierNames] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('DRAFT');
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
      const [fetchedOrders, fetchedSuppliers] = await Promise.all([
        purchasingApi.listOrders(session.accessToken, {
          status: statusFilter === 'all' ? undefined : statusFilter,
          limit: 100,
        }),
        purchasingApi.listSuppliers(session.accessToken).catch(() => [] as Supplier[]),
      ]);
      setOrders(Array.isArray(fetchedOrders) ? fetchedOrders : []);
      const list = Array.isArray(fetchedSuppliers) ? fetchedSuppliers : [];
      setSuppliers(list);
      const names: Record<string, string> = {};
      for (const supplier of list) names[supplier._id] = supplier.name;
      setSupplierNames(names);
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
      return <LoadingState label="Cargando compras…" />;
    }
    if (error && orders.length === 0) {
      return (
        <ErrorState
          title="No se pudo cargar compras"
          detail={error}
          onRetry={() => void loadData()}
        />
      );
    }
    if (orders.length === 0) {
      return <EmptyState title="Sin órdenes" detail="No hay órdenes de compra en este estado." />;
    }
    return (
      <FlatList
        data={orders}
        keyExtractor={(o) => o._id}
        scrollEnabled={false}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] ?? { label: item.status, tone: 'neutral' as BadgeTone };
          const received = item.lines.reduce((s, l) => s + l.quantityReceived, 0);
          const ordered = item.lines.reduce((s, l) => s + l.quantity, 0);
          return (
            <Pressable
              onPress={() => navigation.navigate('PurchaseOrderDetail', { orderId: item._id })}
              accessibilityRole="button"
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
              <Card style={styles.itemCard}>
                <View style={styles.headerRow}>
                  <Text style={[styles.orderId, { color: palette.textPrimary }]}>OC #{item.folio}</Text>
                  <StatusBadge label={meta.label} tone={meta.tone} />
                </View>
                <Text style={[styles.supplier, { color: palette.textSecondary }]}>
                  {supplierNames[item.supplierId] ?? 'Proveedor'}
                </Text>
                <View style={styles.footerRow}>
                  <Text style={[styles.footer, { color: palette.textMuted }]}>
                    {item.lines.length} líneas · Recibido {received}/{ordered}
                  </Text>
                  <Text style={[styles.total, { color: palette.textPrimary }]}>
                    ${item.subtotal.toFixed(2)}
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
        title="Compras"
        subtitle="Órdenes y proveedores"
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
            onPress={() => navigation.navigate('PurchaseOrderForm')}
            accessibilityRole="button"
            accessibilityLabel="Nueva orden de compra">
            <Text style={styles.actionText}>+ Nueva orden</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: palette.surfaceSecondary, borderColor: palette.borderStrong, borderWidth: 1 }]}
            onPress={() => navigation.navigate('SupplierForm')}
            accessibilityRole="button"
            accessibilityLabel="Nuevo proveedor">
            <Text style={[styles.actionText, { color: palette.textPrimary }]}>+ Proveedor</Text>
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
        <SectionHeader title={`Proveedores (${suppliers.length})`} />
        {suppliers.slice(0, 5).map((supplier) => (
          <Card key={supplier._id} style={styles.itemCard}>
            <ListItem
              title={`${supplier.code} · ${supplier.name}`}
              subtitle={supplier.email ?? supplier.phone ?? 'Sin contacto'}
              icon="purchasing"
              badgeLabel={supplier.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              badgeTone={supplier.status === 'ACTIVE' ? 'success' : 'neutral'}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  orderId: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
  },
  supplier: {
    fontSize: typography.body.fontSize,
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  footer: {
    fontSize: typography.bodySmall.fontSize,
  },
  total: {
    fontSize: typography.numeric.fontSize,
    fontWeight: typography.numeric.fontWeight,
  },
});

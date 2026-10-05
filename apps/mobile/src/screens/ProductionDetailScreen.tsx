import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ListItem } from '../components/ListItem';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { pushAlert, unreadAlertsCount } from '../data/alerts';
import {
  friendlyMessage,
  inventoryApi,
  loadSession,
  productionApi,
  type ProductionOrder,
} from '../lib/api';
import type { RootStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<RootStackParamList, 'ProductionDetail'>;

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  RELEASED: { label: 'Liberada', tone: 'info' },
  IN_PROGRESS: { label: 'En proceso', tone: 'info' },
  PAUSED: { label: 'Pausada', tone: 'warning' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

export function ProductionDetailScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const route = useRoute<DetailRoute>();
  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await loadSession();
      if (!session?.accessToken) {
        setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const fetched = await productionApi.getOrder(session.accessToken, route.params.orderId);
      setOrder(fetched);
      try {
        const catalog = await inventoryApi.listProducts(session.accessToken, { limit: 100 });
        const names: Record<string, string> = {};
        for (const product of Array.isArray(catalog) ? catalog : []) {
          names[product._id] = `${product.sku} · ${product.name}`;
        }
        setProductNames(names);
      } catch {
        setProductNames({});
      }
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [route.params.orderId]);

  useFocusEffect(
    useCallback(() => {
      void loadOrder();
    }, [loadOrder]),
  );

  async function doTransition(
    to: 'RELEASED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED',
    confirmTitle: string,
    confirmDetail: string,
    extra?: { producedQuantity?: number },
  ): Promise<void> {
    if (!order) return;
    Alert.alert(confirmTitle, confirmDetail, [
      { text: 'Volver', style: 'cancel' },
      { text: 'Confirmar', onPress: () => void runTransition(to, extra) },
    ]);
  }

  async function runTransition(
    to: 'RELEASED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED' | 'CANCELLED',
    extra?: { producedQuantity?: number },
  ): Promise<void> {
    if (!order) return;
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setActing(true);
    try {
      const updated = await productionApi.transitionOrder(
        session.accessToken,
        order._id,
        to,
        order.version,
        extra,
      );
      setOrder(updated);
      if (to === 'COMPLETED') {
        pushAlert('production', 'Producción completada', `Orden ${updated.code} · ${updated.producedQuantity} unidades`, 'success');
      } else if (to === 'RELEASED') {
        pushAlert('production', 'Orden liberada', `Orden ${updated.code}`, 'info');
      }
    } catch (err) {
      Alert.alert('Error', friendlyMessage(err));
    } finally {
      setActing(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!order) return;
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setActing(true);
    try {
      const updated = await productionApi.cancelOrder(session.accessToken, order._id);
      setOrder(updated);
      pushAlert('production', 'Orden cancelada', `Orden ${updated.code}`, 'info');
    } catch (err) {
      Alert.alert('Error', friendlyMessage(err));
    } finally {
      setActing(false);
    }
  }

  const meta = order ? (STATUS_META[order.status] ?? { label: order.status, tone: 'neutral' as BadgeTone }) : null;
  const progress = order && order.quantity > 0 ? Math.min(100, Math.round((order.producedQuantity / order.quantity) * 100)) : 0;

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title={order ? `Orden #${order.code}` : 'Orden'}
        subtitle="Detalle de producción"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      {loading ? (
        <LoadingState label="Cargando orden…" />
      ) : error || !order || !meta ? (
        <ErrorState title="Orden no encontrada" detail={error ?? undefined} onRetry={() => void loadOrder()} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.headerRow}>
              <Text style={[styles.product, { color: palette.textPrimary }]}>
                {productNames[order.productId] ?? 'Producto'}
              </Text>
              <StatusBadge label={meta.label} tone={meta.tone} />
            </View>
            <Text style={[styles.progressLabel, { color: palette.textSecondary }]}>
              Progreso · {order.producedQuantity}/{order.quantity} ({progress}%)
            </Text>
            <View style={[styles.track, { backgroundColor: palette.backgroundSecondary }]}>
              <View style={[styles.fill, { width: `${progress}%`, backgroundColor: palette.accent }]} />
            </View>
          </Card>

          <SectionHeader title="Asignación" />
          <Card style={styles.listCard}>
            <ListItem title="Máquina" subtitle={order.machine ?? 'Sin asignar'} icon="production" />
            <ListItem title="Responsable" subtitle={order.responsible ?? 'Sin asignar'} icon="hr" />
            <ListItem title="Compromiso" subtitle={order.dueDate ?? 'Sin fecha'} icon="info" />
          </Card>

          <SectionHeader title={`Materiales (${order.materials.length})`} />
          <Card style={styles.listCard}>
            {order.materials.length === 0 ? (
              <EmptyState title="Sin materiales" detail="Esta orden no registra consumo de materiales." />
            ) : (
              order.materials.map((m) => (
                <ListItem
                  key={m.productId}
                  title={productNames[m.productId] ?? 'Material'}
                  subtitle={`Requerido: ${m.quantityRequired} · Consumido: ${m.quantityConsumed}`}
                  icon="inventory"
                />
              ))
            )}
          </Card>

          {order.status === 'DRAFT' ? (
            <>
              <SectionHeader title="Acciones" />
              <Button
                label="Liberar orden"
                onPress={() => void doTransition('RELEASED', 'Liberar orden', 'La orden pasará a Liberada y podrá iniciarse.')}
                loading={acting}
                disabled={acting}
              />
            </>
          ) : null}
          {order.status === 'RELEASED' || order.status === 'PAUSED' ? (
            <>
              <SectionHeader title="Acciones" />
              <Button
                label={order.status === 'PAUSED' ? 'Reanudar' : 'Iniciar producción'}
                onPress={() => void doTransition('IN_PROGRESS', 'Iniciar producción', 'La orden pasará a En proceso.')}
                loading={acting}
                disabled={acting}
              />
            </>
          ) : null}
          {order.status === 'IN_PROGRESS' ? (
            <>
              <SectionHeader title="Acciones" />
              <View style={styles.actions}>
                <Button
                  label="Pausar"
                  variant="secondary"
                  onPress={() => void doTransition('PAUSED', 'Pausar producción', 'La orden pasará a Pausada.')}
                  loading={acting}
                  disabled={acting}
                />
                <Button
                  label="Completar"
                  onPress={() => void doTransition('COMPLETED', 'Completar producción', 'Se registrará el consumo de materiales y la cantidad producida.')}
                  loading={acting}
                  disabled={acting}
                />
              </View>
            </>
          ) : null}
          {['DRAFT', 'RELEASED', 'PAUSED'].includes(order.status) ? (
            <View style={styles.cancelWrap}>
              <Button
                label="Cancelar orden"
                variant="danger"
                onPress={() => {
                  Alert.alert('Cancelar orden', 'La orden quedará Cancelada. Esta acción queda registrada.', [
                    { text: 'Volver', style: 'cancel' },
                    { text: 'Cancelar orden', style: 'destructive', onPress: () => void handleCancel() },
                  ]);
                }}
                loading={acting}
                disabled={acting}
              />
            </View>
          ) : null}
          {order.completedAt ? (
            <Text style={[styles.foot, { color: palette.textMuted }]}>Completada: {order.completedAt}</Text>
          ) : null}
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
  actions: {
    gap: spacing.sm,
  },
  cancelWrap: {
    marginTop: spacing.sm,
  },
  foot: {
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
  },
});

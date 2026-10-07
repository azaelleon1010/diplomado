import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge, type BadgeTone } from '../components/StatusBadge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ListItem } from '../components/ListItem';
import { ErrorState, LoadingState } from '../components/States';
import { pushAlert, unreadAlertsCount } from '../data/alerts';
import {
  friendlyMessage,
  loadSession,
  maintenanceApi,
  type MaintenanceOrder,
} from '../lib/api';
import type { OperationsStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<OperationsStackParamList, 'MaintenanceOrderDetail'>;

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Abierta', tone: 'warning' },
  IN_PROGRESS: { label: 'En curso', tone: 'info' },
  ON_HOLD: { label: 'En espera', tone: 'neutral' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

export function MaintenanceOrderDetailScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const route = useRoute<DetailRoute>();
  const [order, setOrder] = useState<MaintenanceOrder | null>(null);
  const [assetName, setAssetName] = useState('');
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
      const fetched = await maintenanceApi.getOrder(session.accessToken, route.params.orderId);
      setOrder(fetched);
      try {
        const assets = await maintenanceApi.listAssets(session.accessToken);
        const found = (Array.isArray(assets) ? assets : []).find((a) => a._id === fetched.assetId);
        setAssetName(found ? `${found.code} · ${found.name}` : fetched.assetId);
      } catch {
        setAssetName(fetched.assetId);
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
    to: 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED',
    confirmTitle: string,
    confirmDetail: string,
  ): Promise<void> {
    if (!order) return;
    Alert.alert(confirmTitle, confirmDetail, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => void runTransition(to),
      },
    ]);
  }

  async function runTransition(to: 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'): Promise<void> {
    if (!order) return;
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    setActing(true);
    try {
      const updated = await maintenanceApi.transitionOrder(
        session.accessToken,
        order._id,
        to,
        order.version,
      );
      setOrder(updated);
      if (to === 'COMPLETED') {
        pushAlert('maintenance', 'Mantenimiento completado', `${updated.title}`, 'success');
      } else if (to === 'IN_PROGRESS') {
        pushAlert('maintenance', 'Mantenimiento iniciado', `${updated.title}`, 'info');
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
      const updated = await maintenanceApi.cancelOrder(session.accessToken, order._id);
      setOrder(updated);
      pushAlert('maintenance', 'Orden cancelada', `${updated.title}`, 'info');
    } catch (err) {
      Alert.alert('Error', friendlyMessage(err));
    } finally {
      setActing(false);
    }
  }

  const meta = order ? (STATUS_META[order.status] ?? { label: order.status, tone: 'neutral' as BadgeTone }) : null;

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Orden de mantenimiento"
        subtitle={order ? order.title : undefined}
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      {loading ? (
        <LoadingState label="Cargando orden…" />
      ) : error || !order || !meta ? (
        <ErrorState
          title="No se pudo cargar la orden"
          detail={error ?? undefined}
          onRetry={() => void loadOrder()}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>{order.title}</Text>
              <StatusBadge label={meta.label} tone={meta.tone} />
            </View>
            <Text style={[styles.detail, { color: palette.textSecondary }]}>
              {order.type === 'PREVENTIVE' ? 'Preventivo' : 'Correctivo'} · Prioridad {order.priority}
            </Text>
            {order.description ? (
              <Text style={[styles.detail, { color: palette.textSecondary }]}>{order.description}</Text>
            ) : null}
          </Card>

          <SectionHeader title="Asignación" />
          <Card style={styles.listCard}>
            <ListItem title="Activo" subtitle={assetName} icon="maintenance" />
            <ListItem
              title="Asignado a"
              subtitle={order.assignedTo ?? 'Sin asignar'}
              icon="user"
            />
            <ListItem
              title="Programada"
              subtitle={order.scheduledFor ?? 'Sin fecha'}
              icon="info"
            />
            <ListItem title="Costo" subtitle={`$${order.cost.toFixed(2)}`} icon="finance" />
          </Card>

          {order.status === 'OPEN' || order.status === 'ON_HOLD' ? (
            <>
              <SectionHeader title="Acciones" />
              <Button
                label="Iniciar trabajo"
                onPress={() => void doTransition('IN_PROGRESS', 'Iniciar trabajo', 'La orden pasará a En curso y el activo a En mantenimiento.')}
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
                  onPress={() => void doTransition('ON_HOLD', 'Pausar trabajo', 'La orden pasará a En espera.')}
                  loading={acting}
                  disabled={acting}
                />
                <Button
                  label="Completar"
                  onPress={() => void doTransition('COMPLETED', 'Completar trabajo', 'La orden quedará Completada y el activo volverá a Activo.')}
                  loading={acting}
                  disabled={acting}
                />
              </View>
            </>
          ) : null}
          {order.status === 'OPEN' || order.status === 'IN_PROGRESS' || order.status === 'ON_HOLD' ? (
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
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    flex: 1,
  },
  detail: {
    fontSize: typography.body.fontSize,
    marginTop: spacing.sm,
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

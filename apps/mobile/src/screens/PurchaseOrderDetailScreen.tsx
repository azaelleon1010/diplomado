import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { ErrorState, LoadingState } from '../components/States';
import { pushAlert, unreadAlertsCount } from '../data/alerts';
import {
  friendlyMessage,
  inventoryApi,
  loadSession,
  purchasingApi,
  type Product,
  type PurchaseOrder,
} from '../lib/api';
import type { OperationsStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<OperationsStackParamList, 'PurchaseOrderDetail'>;

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  SENT: { label: 'Enviada', tone: 'info' },
  APPROVED: { label: 'Aprobada', tone: 'info' },
  PARTIALLY_RECEIVED: { label: 'Parcial', tone: 'warning' },
  RECEIVED: { label: 'Recibida', tone: 'success' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
};

export function PurchaseOrderDetailScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const route = useRoute<DetailRoute>();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [supplierName, setSupplierName] = useState('');
  const [received, setReceived] = useState<Record<string, string>>({});
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
      const fetched = await purchasingApi.getOrder(session.accessToken, route.params.orderId);
      setOrder(fetched);
      try {
        const [catalog, suppliers] = await Promise.all([
          inventoryApi.listProducts(session.accessToken, { limit: 100 }).catch(() => [] as Product[]),
          purchasingApi.listSuppliers(session.accessToken).catch(() => []),
        ]);
        const names: Record<string, string> = {};
        for (const product of Array.isArray(catalog) ? catalog : []) {
          names[product._id] = `${product.sku} · ${product.name}`;
        }
        setProductNames(names);
        const found = (Array.isArray(suppliers) ? suppliers : []).find((s) => s._id === fetched.supplierId);
        setSupplierName(found ? `${found.code} · ${found.name}` : fetched.supplierId);
      } catch {
        setProductNames({});
        setSupplierName(fetched.supplierId);
      }
      const initial: Record<string, string> = {};
      for (const line of fetched.lines) {
        initial[line.productId] = String(line.quantityReceived > 0 ? line.quantityReceived : line.quantity);
      }
      setReceived(initial);
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
    to: 'SENT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED',
    confirmTitle: string,
    confirmDetail: string,
    withLines = false,
  ): Promise<void> {
    if (!order) return;
    Alert.alert(confirmTitle, confirmDetail, [
      { text: 'Volver', style: 'cancel' },
      { text: 'Confirmar', onPress: () => void runTransition(to, withLines) },
    ]);
  }

  async function runTransition(
    to: 'SENT' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED',
    withLines: boolean,
  ): Promise<void> {
    if (!order) return;
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Tu sesión no está disponible. Inicia sesión nuevamente.');
      return;
    }
    let lines: Array<{ productId: string; quantityReceived: number }> | undefined;
    if (withLines) {
      lines = [];
      for (const line of order.lines) {
        const qty = Number(received[line.productId] ?? line.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          Alert.alert('Dato inválido', 'Cada línea recibida debe tener cantidad mayor a 0.');
          return;
        }
        if (qty > line.quantity) {
          Alert.alert('Dato inválido', 'Lo recibido no puede superar lo ordenado.');
          return;
        }
        lines.push({ productId: line.productId, quantityReceived: qty });
      }
    }
    setActing(true);
    try {
      const updated = await purchasingApi.transitionOrder(
        session.accessToken,
        order._id,
        to,
        order.version,
        lines,
      );
      setOrder(updated);
      if (to === 'RECEIVED') {
        pushAlert('purchasing', 'Mercancía recibida', `OC ${updated.folio} · $${updated.subtotal.toFixed(2)}`, 'success');
      } else if (to === 'APPROVED') {
        pushAlert('purchasing', 'Orden aprobada', `OC ${updated.folio}`, 'info');
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
      const updated = await purchasingApi.cancelOrder(session.accessToken, order._id);
      setOrder(updated);
      pushAlert('purchasing', 'Orden cancelada', `OC ${updated.folio}`, 'info');
    } catch (err) {
      Alert.alert('Error', friendlyMessage(err));
    } finally {
      setActing(false);
    }
  }

  const meta = order ? (STATUS_META[order.status] ?? { label: order.status, tone: 'neutral' as BadgeTone }) : null;
  const canReceive = order?.status === 'APPROVED' || order?.status === 'PARTIALLY_RECEIVED';

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title={order ? `OC ${order.folio}` : 'Orden de compra'}
        subtitle="Detalle y recepción"
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
              <Text style={[styles.title, { color: palette.textPrimary }]}>OC #{order.folio}</Text>
              <StatusBadge label={meta.label} tone={meta.tone} />
            </View>
            <Text style={[styles.detail, { color: palette.textSecondary }]}>
              {supplierName} · ${order.subtotal.toFixed(2)}
            </Text>
            {order.expectedDate ? (
              <Text style={[styles.detail, { color: palette.textSecondary }]}>Esperada: {order.expectedDate}</Text>
            ) : null}
          </Card>

          <SectionHeader title={`Líneas (${order.lines.length})`} />
          <Card style={styles.listCard}>
            {order.lines.map((line) => (
              <View key={line.productId}>
                <ListItem
                  title={productNames[line.productId] ?? 'Producto'}
                  subtitle={`Ordenado: ${line.quantity} · Recibido: ${line.quantityReceived} · $${line.unitCost.toFixed(2)} c/u`}
                  icon="inventory"
                />
                {canReceive ? (
                  <TextInput
                    value={received[line.productId] ?? String(line.quantity)}
                    onChangeText={(v) => setReceived((prev) => ({ ...prev, [line.productId]: v }))}
                    placeholder="Cantidad a recibir"
                    placeholderTextColor={palette.textMuted}
                    keyboardType="decimal-pad"
                    style={[styles.receiveInput, { color: palette.textPrimary, borderColor: palette.borderStrong, backgroundColor: palette.backgroundSecondary }]}
                    accessibilityLabel={`Cantidad a recibir de ${productNames[line.productId] ?? line.productId}`}
                  />
                ) : null}
              </View>
            ))}
          </Card>

          {order.status === 'DRAFT' ? (
            <>
              <SectionHeader title="Acciones" />
              <Button
                label="Enviar al proveedor"
                onPress={() => void doTransition('SENT', 'Enviar orden', 'La orden pasará a Enviada.')}
                loading={acting}
                disabled={acting}
              />
            </>
          ) : null}
          {order.status === 'SENT' ? (
            <>
              <SectionHeader title="Acciones" />
              <Button
                label="Aprobar orden"
                onPress={() => void doTransition('APPROVED', 'Aprobar orden', 'La orden pasará a Aprobada y podrá recibirse.')}
                loading={acting}
                disabled={acting}
              />
            </>
          ) : null}
          {canReceive ? (
            <>
              <SectionHeader title="Recepción" />
              <View style={styles.actions}>
                <Button
                  label="Recepción parcial"
                  variant="secondary"
                  onPress={() => void doTransition('PARTIALLY_RECEIVED', 'Recepción parcial', 'Se registrarán las cantidades indicadas.')}
                  loading={acting}
                  disabled={acting}
                />
                <Button
                  label="Recibir todo"
                  onPress={() => void doTransition('RECEIVED', 'Recepción total', 'Se registrará la recepción completa de la orden.')}
                  loading={acting}
                  disabled={acting}
                />
              </View>
            </>
          ) : null}
          {['DRAFT', 'SENT', 'APPROVED', 'PARTIALLY_RECEIVED'].includes(order.status) ? (
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
          {order.receivedAt ? (
            <Text style={[styles.foot, { color: palette.textMuted }]}>Recibida: {order.receivedAt}</Text>
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
  receiveInput: {
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
    marginBottom: spacing.sm,
  },
  foot: {
    fontSize: typography.bodySmall.fontSize,
    textAlign: 'center',
  },
});

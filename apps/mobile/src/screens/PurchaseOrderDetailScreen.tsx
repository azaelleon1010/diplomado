import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge } from '../components/StatusBadge';
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
  type GoodsReceipt,
  type Product,
  type PurchaseOrder,
} from '../lib/api';
import {
  ORDER_STATUS,
  describePurchasingError,
  formatMoney,
  orderActions,
  pendingToReceive,
} from '../../../../packages/types/src/purchasing';
import type { OperationsStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<OperationsStackParamList, 'PurchaseOrderDetail'>;

export function PurchaseOrderDetailScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName, me } = useAuth();
  const navigation = useAppNavigation();
  const route = useRoute<DetailRoute>();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [productNames, setProductNames] = useState<Record<string, string>>({});
  const [supplierName, setSupplierName] = useState('');
  const [currency, setCurrency] = useState('MXN');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const loadOrder = useCallback(async () => {
    setError(null);
    try {
      const session = await loadSession();
      if (!session?.accessToken) {
        setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const fetched = await purchasingApi.getOrder(session.accessToken, route.params.orderId);
      setOrder(fetched);
      const [catalog, suppliers, receiptPage] = await Promise.all([
        inventoryApi.listProducts(session.accessToken, { limit: 100 }).catch(() => [] as Product[]),
        purchasingApi.listSuppliers(session.accessToken).then((p) => p.items).catch(() => []),
        purchasingApi.listReceipts(session.accessToken, { purchaseOrderId: fetched._id }).then((p) => p.items).catch(() => [] as GoodsReceipt[]),
      ]);
      setProductNames(Object.fromEntries(catalog.map((p) => [p._id, `${p.sku} · ${p.name}`])));
      const supplier = suppliers.find((s) => s._id === fetched.supplierId);
      setSupplierName(supplier ? `${supplier.code} · ${supplier.name}` : 'Proveedor');
      setCurrency(supplier?.currency ?? 'MXN');
      setReceipts(receiptPage);
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

  async function transition(to: 'SENT' | 'APPROVED' | 'CANCELLED'): Promise<void> {
    if (!order) return;
    const session = await loadSession();
    if (!session?.accessToken) {
      Alert.alert('Sesión no disponible', 'Inicia sesión nuevamente.');
      return;
    }
    setActing(true);
    try {
      const updated = await purchasingApi.transitionOrder(session.accessToken, order._id, to, order.version);
      setOrder(updated);
      if (to === 'APPROVED') pushAlert('purchasing', 'Orden aprobada', `OC ${updated.folio}`, 'info');
      if (to === 'CANCELLED') pushAlert('purchasing', 'Orden cancelada', `OC ${updated.folio}`, 'info');
    } catch (err) {
      Alert.alert('No se pudo completar', describePurchasingError(err) ?? friendlyMessage(err));
      void loadOrder();
    } finally {
      setActing(false);
    }
  }

  function confirm(title: string, detail: string, action: () => void, destructive = false): void {
    Alert.alert(title, detail, [
      { text: 'Volver', style: 'cancel' },
      { text: 'Confirmar', style: destructive ? 'destructive' : 'default', onPress: action },
    ]);
  }

  const actions = order ? orderActions(order, me?.permissions ?? []) : [];
  const meta = order ? ORDER_STATUS[order.status] : null;

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title={order ? `OC ${order.folio}` : 'Orden de compra'}
        subtitle="Detalle, aprobación y recepción"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      {loading ? (
        <LoadingState label="Cargando orden…" />
      ) : error || !order || !meta ? (
        <ErrorState title="Orden no encontrada" detail={error ?? undefined} onRetry={() => { setLoading(true); void loadOrder(); }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Card>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: palette.textPrimary }]}>OC {order.folio}</Text>
              <StatusBadge label={meta.label} tone={meta.tone} />
            </View>
            <Text style={[styles.detail, { color: palette.textSecondary }]}>{supplierName}</Text>
            <Text style={[styles.amount, { color: palette.textPrimary }]}>{formatMoney(order.subtotal, currency)}</Text>
            {order.expectedDate ? <Text style={[styles.detail, { color: palette.textSecondary }]}>Esperada: {order.expectedDate}</Text> : null}
          </Card>

          {actions.includes('RECEIVE') ? (
            <Button
              label="Registrar recepción"
              onPress={() => navigation.navigate('PurchaseReceive', { orderId: order._id })}
              disabled={acting}
            />
          ) : null}
          {actions.includes('SEND') ? (
            <Button label="Enviar al proveedor" variant="secondary" loading={acting} disabled={acting} onPress={() => confirm('Enviar orden', 'La orden pasará a Enviada.', () => void transition('SENT'))} />
          ) : null}
          {actions.includes('APPROVE') ? (
            <Button label="Aprobar orden" loading={acting} disabled={acting} onPress={() => confirm('Aprobar orden', `Se aprobará por ${formatMoney(order.subtotal, currency)} y podrá recibirse.`, () => void transition('APPROVED'))} />
          ) : null}

          <SectionHeader title={`Líneas (${order.lines.length})`} />
          <Card style={styles.listCard}>
            {order.lines.map((line) => {
              const pending = pendingToReceive(line);
              return (
                <ListItem
                  key={line.productId}
                  title={productNames[line.productId] ?? 'Producto'}
                  subtitle={`Ordenado ${line.quantity} · Recibido ${line.quantityReceived} · Facturado ${line.quantityInvoiced} · ${formatMoney(line.unitCost, currency)} c/u`}
                  badgeLabel={pending > 0 ? `Pendiente ${pending}` : 'Completo'}
                  badgeTone={pending > 0 ? 'warning' : 'success'}
                  icon="inventory"
                />
              );
            })}
          </Card>

          <SectionHeader title={`Recepciones (${receipts.length})`} />
          <Card style={styles.listCard}>
            {receipts.length === 0 ? (
              <Text style={[styles.empty, { color: palette.textSecondary }]}>Aún no hay recepciones.</Text>
            ) : (
              receipts.map((r) => (
                <ListItem
                  key={r._id}
                  title={r.folio}
                  subtitle={`${new Date(r.receivedAt).toLocaleString('es-MX')} · ${r.lines.length} línea(s)`}
                  rightText={formatMoney(r.total, currency)}
                  icon="purchasing"
                />
              ))
            )}
          </Card>

          {actions.includes('CANCEL') ? (
            <View style={styles.cancelWrap}>
              <Button
                label="Cancelar orden"
                variant="danger"
                loading={acting}
                disabled={acting}
                onPress={() => confirm('Cancelar orden', 'La orden quedará Cancelada. Lo ya recibido permanece en inventario.', () => void transition('CANCELLED'), true)}
              />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  title: { fontSize: typography.h3.fontSize, fontWeight: typography.h3.fontWeight, flex: 1 },
  detail: { fontSize: typography.body.fontSize, marginTop: spacing.sm },
  amount: { fontSize: 24, fontWeight: '800', marginTop: spacing.sm },
  listCard: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  empty: { paddingVertical: spacing.md, fontSize: 14 },
  cancelWrap: { marginTop: spacing.sm },
});

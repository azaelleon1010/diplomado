import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { Chip } from '../components/Chip';
import { pushAlert } from '../data/alerts';
import { friendlyMessage, inventoryApi, loadSession, purchasingApi, stockApi, type Product, type PurchaseOrder } from '../lib/api';
import { formatQuantity, newIdempotencyKey, parseStockQuantity, type InventoryWarehouse } from '../../../../packages/types/src/inventory';
import { ORDER_STATUS, describePurchasingError, pendingToReceive } from '../../../../packages/types/src/purchasing';
import type { OperationsStackParamList } from '../navigation/types';

type ReceiveRoute = RouteProp<OperationsStackParamList, 'PurchaseReceive'>;

/** Dock reception: pending quantities prefilled, one tap per line, big inputs. */
export function PurchaseReceiveScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const route = useRoute<ReceiveRoute>();

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // Stable while the capture is unchanged: a retry after a network error
  // cannot receive twice.
  const [operationKey, setOperationKey] = useState(() => newIdempotencyKey('rcv'));
  const touch = () => setOperationKey(newIdempotencyKey('rcv'));

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await loadSession();
        if (!session?.accessToken) throw new Error('Tu sesión no está disponible. Inicia sesión nuevamente.');
        const [fetched, catalog, warehousePage] = await Promise.all([
          purchasingApi.getOrder(session.accessToken, route.params.orderId),
          inventoryApi.listProducts(session.accessToken, { limit: 100 }),
          stockApi.listWarehouses(session.accessToken),
        ]);
        if (!active) return;
        const activeWarehouses = warehousePage.items.filter((w) => w.status === 'ACTIVE');
        setOrder(fetched);
        setProducts(Object.fromEntries(catalog.map((p) => [p._id, p])));
        setWarehouses(activeWarehouses);
        if (activeWarehouses.length === 1) setWarehouseId(activeWarehouses[0]!._id);
        setQuantities(Object.fromEntries(fetched.lines.map((l) => [l.productId, pendingToReceive(l) > 0 ? String(pendingToReceive(l)) : '0'])));
      } catch (error) {
        if (active) setLoadError(friendlyMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [route.params.orderId]);

  const pendingLines = useMemo(() => (order ? order.lines.filter((l) => pendingToReceive(l) > 0) : []), [order]);

  function setQty(productId: string, value: string): void {
    setQuantities((q) => ({ ...q, [productId]: value }));
    touch();
  }

  async function submit(): Promise<void> {
    if (!order) return;
    if (!warehouseId) return Alert.alert('Falta información', 'Selecciona el almacén donde entra la mercancía.');
    const lines: Array<{ productId: string; quantity: number }> = [];
    for (const line of pendingLines) {
      const raw = (quantities[line.productId] ?? '').trim();
      if (raw === '' || raw === '0') continue;
      const qty = parseStockQuantity(raw);
      const name = products[line.productId]?.name ?? 'producto';
      if (qty === undefined) return Alert.alert('Cantidad inválida', `Revisa la cantidad de ${name}.`);
      if (qty > pendingToReceive(line)) return Alert.alert('Cantidad excedida', `${name}: pendiente ${formatQuantity(pendingToReceive(line))}.`);
      lines.push({ productId: line.productId, quantity: qty });
    }
    if (lines.length === 0) return Alert.alert('Sin cantidades', 'Captura al menos una cantidad recibida.');

    const warehouse = warehouses.find((w) => w._id === warehouseId);
    Alert.alert('Confirmar recepción', `${lines.length} producto(s) entrarán a ${warehouse?.code ?? 'el almacén'}.`, [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Recibir',
        onPress: () => {
          void (async () => {
            const session = await loadSession();
            if (!session?.accessToken) return Alert.alert('Sesión no disponible', 'Inicia sesión nuevamente.');
            setSaving(true);
            try {
              const result = await purchasingApi.receiveOrder(session.accessToken, order._id, {
                warehouseId,
                lines,
                notes: notes.trim() || undefined,
                idempotencyKey: operationKey,
              });
              pushAlert('purchasing', 'Mercancía recibida', `${result.receipt.folio} · OC ${result.order.folio}`, 'success');
              Alert.alert('Recepción registrada', `${result.receipt.folio}\nOrden: ${ORDER_STATUS[result.order.status].label}`, [
                { text: 'Aceptar', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              Alert.alert('No se pudo registrar', describePurchasingError(error) ?? friendlyMessage(error));
            } finally {
              setSaving(false);
            }
          })();
        },
      },
    ]);
  }

  const input = { color: palette.textPrimary, backgroundColor: palette.surface, borderColor: palette.borderStrong };

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar title="Recepción" subtitle={order ? `OC ${order.folio}` : 'Orden de compra'} showBack onBack={() => navigation.goBack()} userName={userName} />
      {loading ? (
        <ActivityIndicator style={styles.loader} color={palette.accent} />
      ) : loadError || !order ? (
        <Text style={[styles.message, { color: palette.danger }]}>{loadError ?? 'Orden no encontrada.'}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: palette.textPrimary }]}>Almacén de entrada</Text>
          {warehouses.length === 0 ? (
            <Text style={{ color: palette.danger }}>No hay almacenes activos. Créalos desde la Web.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {warehouses.map((w) => (
                <Chip key={w._id} label={`${w.code} · ${w.name}`} selected={warehouseId === w._id} onPress={() => { setWarehouseId(w._id); touch(); }} />
              ))}
            </ScrollView>
          )}

          {pendingLines.length === 0 ? (
            <Text style={[styles.message, { color: palette.textSecondary }]}>No hay cantidades pendientes en esta orden.</Text>
          ) : (
            pendingLines.map((line) => {
              const product = products[line.productId];
              const pending = pendingToReceive(line);
              return (
                <View key={line.productId} style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.borderStrong }]}>
                  <Text style={[styles.product, { color: palette.textPrimary }]}>{product?.name ?? 'Producto'}</Text>
                  <Text style={{ color: palette.textSecondary }}>
                    SKU {product?.sku ?? '—'} · Pendiente {formatQuantity(pending)} {product?.unit ?? ''}
                  </Text>
                  <View style={styles.qtyRow}>
                    <TextInput
                      value={quantities[line.productId] ?? ''}
                      onChangeText={(v) => setQty(line.productId, v)}
                      keyboardType="decimal-pad"
                      style={[styles.qty, input]}
                      accessibilityLabel={`Cantidad recibida de ${product?.name ?? 'producto'}`}
                    />
                    <TouchableOpacity style={[styles.quick, { borderColor: palette.brand }]} onPress={() => setQty(line.productId, String(pending))}>
                      <Text style={[styles.quickText, { color: palette.brand }]}>Todo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.quick, { borderColor: palette.borderStrong }]} onPress={() => setQty(line.productId, '0')}>
                      <Text style={[styles.quickText, { color: palette.textSecondary }]}>0</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          <TextInput
            value={notes}
            onChangeText={(v) => { setNotes(v); touch(); }}
            placeholder="Notas (remisión, faltantes, daños…)"
            placeholderTextColor={palette.textMuted}
            style={[styles.notes, input]}
            multiline
          />

          {pendingLines.length > 0 ? (
            <TouchableOpacity disabled={saving} onPress={() => void submit()} style={[styles.save, { backgroundColor: palette.brand, opacity: saving ? 0.6 : 1 }]}>
              <Text style={styles.saveText}>{saving ? 'Registrando…' : 'Registrar recepción'}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.hint, { color: palette.textMuted }]}>La mercancía entra al inventario al costo de la orden.</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 60 },
  message: { padding: spacing.xl, fontSize: 15, textAlign: 'center' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  label: { fontSize: 14, fontWeight: '700' },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  card: { borderWidth: 1, borderRadius: 14, padding: spacing.md, gap: spacing.xs },
  product: { fontSize: 17, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
  qty: { flex: 1, minHeight: 60, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, fontSize: 26, fontWeight: '800' },
  quick: { minHeight: 60, minWidth: 64, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 16, fontWeight: '800' },
  notes: { minHeight: 70, borderWidth: 1, borderRadius: 12, padding: spacing.md, fontSize: 15, textAlignVertical: 'top' },
  save: { minHeight: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  hint: { fontSize: 12, textAlign: 'center' },
});

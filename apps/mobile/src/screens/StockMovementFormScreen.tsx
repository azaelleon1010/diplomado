import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SearchBar } from '../components/SearchBar';
import type { OperationsStackParamList } from '../navigation/types';
import { friendlyMessage, inventoryApi, loadSession, stockApi, type Product } from '../lib/api';
import {
  STOCK_MOVEMENT_LABELS,
  STOCK_MOVEMENT_PERMISSION,
  describeStockError,
  formatQuantity,
  newIdempotencyKey,
  parseStockQuantity,
  type InventoryWarehouse,
  type ManualStockMovementType,
} from '../../../../packages/types/src/inventory';
import { hasPermission } from '../../../../packages/types/src/permissions';

type FormRoute = RouteProp<OperationsStackParamList, 'StockMovementForm'>;
type Operation = ManualStockMovementType | 'TRANSFER';
type Picker = 'none' | 'product' | 'warehouse' | 'destination';

const OPERATIONS: Operation[] = ['RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER'];
const OPERATION_LABELS: Record<Operation, string> = {
  RECEIPT: 'Entrada',
  ISSUE: 'Salida',
  ADJUSTMENT_IN: 'Ajuste +',
  ADJUSTMENT_OUT: 'Ajuste −',
  TRANSFER: 'Transferir',
};

/** Quick stock capture: big targets, one product per movement. */
export function StockMovementFormScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName, me } = useAuth();
  const navigation = useAppNavigation();
  const route = useRoute<FormRoute>();
  const permissions = me?.permissions ?? [];

  const allowed = OPERATIONS.filter((op) =>
    op === 'TRANSFER' ? hasPermission(permissions, 'inventory.transfer') : hasPermission(permissions, STOCK_MOVEMENT_PERMISSION[op]),
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [operation, setOperation] = useState<Operation>(allowed[0] ?? 'RECEIPT');
  const [productId, setProductId] = useState(route.params?.productId ?? '');
  const [warehouseId, setWarehouseId] = useState(route.params?.warehouseId ?? '');
  const [destinationId, setDestinationId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [available, setAvailable] = useState<number | null>(null);
  const [picker, setPicker] = useState<Picker>('none');
  const [pickerQuery, setPickerQuery] = useState('');
  const [saving, setSaving] = useState(false);
  // Same key while the payload is unchanged, so a retry after a network
  // failure cannot post twice; any edit starts a new operation.
  const [operationKey, setOperationKey] = useState(() => newIdempotencyKey('mob'));

  const touch = () => setOperationKey(newIdempotencyKey('mob'));

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await loadSession();
        if (!session?.accessToken) throw new Error('Tu sesión no está disponible. Inicia sesión nuevamente.');
        const [productList, warehousePage] = await Promise.all([
          inventoryApi.listProducts(session.accessToken, { limit: 100, status: 'ACTIVE' }),
          stockApi.listWarehouses(session.accessToken),
        ]);
        if (!active) return;
        setProducts(productList.filter((p) => p.trackInventory));
        setWarehouses(warehousePage.items.filter((w) => w.status === 'ACTIVE'));
      } catch (error) {
        if (active) setLoadError(friendlyMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refreshAvailable = useCallback(async () => {
    if (!productId || !warehouseId) {
      setAvailable(null);
      return;
    }
    try {
      const session = await loadSession();
      if (!session?.accessToken) return;
      const page = await stockApi.listStock(session.accessToken, { productId, warehouseId, limit: 1 });
      setAvailable(page.items[0]?.quantity ?? 0);
    } catch {
      setAvailable(null);
    }
  }, [productId, warehouseId]);

  useEffect(() => {
    void refreshAvailable();
  }, [refreshAvailable]);

  const product = products.find((p) => p._id === productId);
  const warehouse = warehouses.find((w) => w._id === warehouseId);
  const destination = warehouses.find((w) => w._id === destinationId);
  const isOut = operation === 'ISSUE' || operation === 'ADJUSTMENT_OUT' || operation === 'TRANSFER';

  const pickerItems = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (picker === 'product') {
      return products
        .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
        .map((p) => ({ id: p._id, title: p.name, subtitle: `SKU ${p.sku} · ${p.unit}` }));
    }
    return warehouses
      .filter((w) => picker !== 'destination' || w._id !== warehouseId)
      .filter((w) => !q || w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q))
      .map((w) => ({ id: w._id, title: w.name, subtitle: w.code }));
  }, [picker, pickerQuery, products, warehouses, warehouseId]);

  function choose(id: string): void {
    if (picker === 'product') setProductId(id);
    if (picker === 'warehouse') setWarehouseId(id);
    if (picker === 'destination') setDestinationId(id);
    touch();
    setPicker('none');
    setPickerQuery('');
  }

  async function submit(): Promise<void> {
    const qty = parseStockQuantity(quantity);
    if (!productId || !warehouseId) return Alert.alert('Falta información', 'Selecciona producto y almacén.');
    if (operation === 'TRANSFER' && !destinationId) return Alert.alert('Falta información', 'Selecciona el almacén de destino.');
    if (qty === undefined) return Alert.alert('Cantidad inválida', 'Debe ser mayor a 0 y tener máximo 3 decimales.');
    if (isOut && available !== null && qty > available) {
      return Alert.alert('Existencia insuficiente', `Disponible en ${warehouse?.code ?? 'el almacén'}: ${formatQuantity(available)}.`);
    }

    const send = async () => {
      const session = await loadSession();
      if (!session?.accessToken) return Alert.alert('Sesión no disponible', 'Inicia sesión nuevamente.');
      setSaving(true);
      try {
        if (operation === 'TRANSFER') {
          await stockApi.transfer(session.accessToken, {
            productId,
            fromWarehouseId: warehouseId,
            toWarehouseId: destinationId,
            quantity: qty,
            reference: reference.trim() || undefined,
            idempotencyKey: operationKey,
          });
        } else {
          await stockApi.postMovements(session.accessToken, {
            lines: [{ productId, warehouseId, type: operation, quantity: qty }],
            reference: reference.trim() || undefined,
            idempotencyKey: operationKey,
          });
        }
        Alert.alert('Movimiento registrado', `${OPERATION_LABELS[operation]}: ${formatQuantity(qty)} ${product?.unit ?? ''}`, [
          { text: 'Registrar otro', onPress: () => { setQuantity(''); setReference(''); touch(); void refreshAvailable(); } },
          { text: 'Terminar', onPress: () => navigation.goBack() },
        ]);
      } catch (error) {
        Alert.alert('No se pudo registrar', describeStockError(error) ?? friendlyMessage(error));
        void refreshAvailable();
      } finally {
        setSaving(false);
      }
    };

    if (isOut) {
      const target = operation === 'TRANSFER' ? ` a ${destination?.code ?? ''}` : '';
      Alert.alert('Confirmar', `${OPERATION_LABELS[operation]} de ${formatQuantity(qty)} ${product?.unit ?? ''} de ${product?.name ?? ''} desde ${warehouse?.code ?? ''}${target}?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => void send() },
      ]);
      return;
    }
    void send();
  }

  if (allowed.length === 0) {
    return (
      <View style={[styles.flex, { backgroundColor: palette.background }]}>
        <TopBar title="Movimiento" showBack onBack={() => navigation.goBack()} userName={userName} />
        <Text style={[styles.message, { color: palette.textSecondary }]}>Tu rol no permite registrar movimientos de inventario.</Text>
      </View>
    );
  }

  const selector = (label: string, value: string | undefined, placeholder: string, onPress: () => void) => (
    <View style={styles.block}>
      <Text style={[styles.label, { color: palette.textPrimary }]}>{label}</Text>
      <TouchableOpacity onPress={onPress} style={[styles.selector, { backgroundColor: palette.surface, borderColor: palette.borderStrong }]}>
        <Text style={[styles.selectorText, { color: value ? palette.textPrimary : palette.textMuted }]} numberOfLines={1}>{value ?? placeholder}</Text>
        <Text style={{ color: palette.textSecondary, fontSize: 20 }}>⌄</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar title="Movimiento de inventario" subtitle="Se registra en el libro de inventario" showBack onBack={() => navigation.goBack()} userName={userName} />
      {loading ? (
        <ActivityIndicator style={styles.loader} color={palette.accent} />
      ) : loadError ? (
        <Text style={[styles.message, { color: palette.danger }]}>{loadError}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.ops}>
            {allowed.map((op) => (
              <TouchableOpacity
                key={op}
                onPress={() => { setOperation(op); touch(); }}
                style={[styles.op, { borderColor: operation === op ? palette.brand : palette.borderStrong, backgroundColor: operation === op ? palette.brandSoft : palette.surface }]}>
                <Text style={[styles.opText, { color: operation === op ? palette.brand : palette.textPrimary }]}>{OPERATION_LABELS[op]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {selector('Producto', product ? `${product.name} (${product.sku})` : undefined, 'Seleccionar producto', () => setPicker('product'))}
          {selector(operation === 'TRANSFER' ? 'Almacén de origen' : 'Almacén', warehouse ? `${warehouse.code} · ${warehouse.name}` : undefined, 'Seleccionar almacén', () => setPicker('warehouse'))}
          {operation === 'TRANSFER'
            ? selector('Almacén de destino', destination ? `${destination.code} · ${destination.name}` : undefined, 'Seleccionar destino', () => setPicker('destination'))
            : null}

          {available !== null ? (
            <Text style={[styles.available, { color: palette.textSecondary }]}>
              Existencia actual: <Text style={{ color: palette.textPrimary, fontWeight: '800' }}>{formatQuantity(available)} {product?.unit ?? ''}</Text>
            </Text>
          ) : null}

          <View style={styles.block}>
            <Text style={[styles.label, { color: palette.textPrimary }]}>Cantidad {product ? `(${product.unit})` : ''}</Text>
            <TextInput
              value={quantity}
              onChangeText={(v) => { setQuantity(v); touch(); }}
              placeholder="0"
              placeholderTextColor={palette.textMuted}
              keyboardType="decimal-pad"
              style={[styles.qty, { color: palette.textPrimary, backgroundColor: palette.surface, borderColor: palette.borderStrong }]}
            />
          </View>

          <View style={styles.block}>
            <Text style={[styles.label, { color: palette.textPrimary }]}>Referencia (opcional)</Text>
            <TextInput
              value={reference}
              onChangeText={(v) => { setReference(v); touch(); }}
              placeholder="Folio, remisión, motivo…"
              placeholderTextColor={palette.textMuted}
              style={[styles.input, { color: palette.textPrimary, backgroundColor: palette.surface, borderColor: palette.borderStrong }]}
            />
          </View>

          <TouchableOpacity
            disabled={saving}
            onPress={() => void submit()}
            style={[styles.save, { backgroundColor: palette.brand, opacity: saving ? 0.6 : 1 }]}>
            <Text style={styles.saveText}>{saving ? 'Registrando…' : `Registrar ${OPERATION_LABELS[operation].toLowerCase()}`}</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: palette.textMuted }]}>
            {operation === 'TRANSFER' ? 'Transferencia' : STOCK_MOVEMENT_LABELS[operation]} · los saldos no pueden quedar negativos.
          </Text>
        </ScrollView>
      )}

      <Modal visible={picker !== 'none'} animationType="slide" transparent onRequestClose={() => setPicker('none')}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: palette.backgroundSecondary }]}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: palette.textPrimary }]}>
                {picker === 'product' ? 'Producto' : picker === 'destination' ? 'Destino' : 'Almacén'}
              </Text>
              <TouchableOpacity onPress={() => setPicker('none')}>
                <Text style={{ color: palette.textSecondary, fontSize: 26 }}>×</Text>
              </TouchableOpacity>
            </View>
            <SearchBar value={pickerQuery} onChange={setPickerQuery} placeholder="Buscar…" />
            <FlatList
              data={pickerItems}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={[styles.message, { color: palette.textSecondary }]}>Sin resultados.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => choose(item.id)} style={[styles.option, { borderBottomColor: palette.borderStrong }]}>
                  <Text style={[styles.optionTitle, { color: palette.textPrimary }]}>{item.title}</Text>
                  <Text style={{ color: palette.textSecondary, fontSize: 13 }}>{item.subtitle}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 60 },
  message: { padding: spacing.xl, fontSize: 15, textAlign: 'center' },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: 60 },
  ops: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  op: { flexGrow: 1, flexBasis: '30%', minHeight: 56, borderWidth: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  opText: { fontSize: 16, fontWeight: '700' },
  block: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '700' },
  selector: { minHeight: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorText: { flex: 1, fontSize: 16 },
  available: { fontSize: 15 },
  qty: { minHeight: 64, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, fontSize: 28, fontWeight: '800' },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, fontSize: 16 },
  save: { minHeight: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  hint: { fontSize: 12, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '80%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: spacing.lg, gap: spacing.sm },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  option: { paddingVertical: spacing.md, borderBottomWidth: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600' },
});

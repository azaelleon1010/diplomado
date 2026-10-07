import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SearchBar } from '../components/SearchBar';
import { Chip } from '../components/Chip';
import { Card } from '../components/Card';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { MODULE_ACCESS, hasAnyPermission } from '../navigation/moduleAccess';
import { friendlyMessage, inventoryApi, loadSession, stockApi, type Product } from '../lib/api';
import {
  STOCK_MOVEMENT_LABELS,
  formatQuantity,
  type InventoryWarehouse,
  type StockBalanceView,
  type StockMovementView,
} from '../../../../packages/types/src/inventory';

interface ProductStock {
  product: Product;
  total: number;
  rows: StockBalanceView[];
}

/** Stock by product (from the ledger API), optimized for floor operators. */
export function StockScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName, me } = useAuth();
  const navigation = useAppNavigation();
  const canMove = hasAnyPermission(me?.permissions ?? [], MODULE_ACCESS.inventoryMove);

  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [balances, setBalances] = useState<StockBalanceView[]>([]);
  const [movements, setMovements] = useState<StockMovementView[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const session = await loadSession();
      if (!session?.accessToken) {
        setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
        return;
      }
      const [warehousePage, productList, stockPage, movementPage] = await Promise.all([
        stockApi.listWarehouses(session.accessToken),
        inventoryApi.listProducts(session.accessToken, { limit: 100 }),
        stockApi.listStock(session.accessToken, { warehouseId: warehouseId || undefined, nonZero: true, limit: 100 }),
        stockApi.listMovements(session.accessToken, { warehouseId: warehouseId || undefined, limit: 10 }),
      ]);
      setWarehouses(warehousePage.items);
      setProducts(productList);
      setBalances(stockPage.items);
      setMovements(movementPage.items);
    } catch (err) {
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const warehouseName = useMemo(() => new Map(warehouses.map((w) => [w._id, `${w.code} · ${w.name}`])), [warehouses]);
  const productName = useMemo(() => new Map(products.map((p) => [p._id, p.name])), [products]);

  const grouped = useMemo<ProductStock[]>(() => {
    const byProduct = new Map<string, ProductStock>();
    for (const balance of balances) {
      const product = products.find((p) => p._id === balance.productId);
      if (!product) continue;
      const entry = byProduct.get(product._id) ?? { product, total: 0, rows: [] };
      entry.total += balance.quantity;
      entry.rows.push(balance);
      byProduct.set(product._id, entry);
    }
    const q = query.trim().toLowerCase();
    return [...byProduct.values()]
      .filter((e) => !q || e.product.name.toLowerCase().includes(q) || e.product.sku.toLowerCase().includes(q))
      .sort((a, b) => a.product.name.localeCompare(b.product.name));
  }, [balances, products, query]);

  const header = (
    <View style={styles.headerBlock}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Todos" selected={warehouseId === ''} onPress={() => setWarehouseId('')} />
        {warehouses.filter((w) => w.status === 'ACTIVE').map((w) => (
          <Chip key={w._id} label={w.code} selected={warehouseId === w._id} onPress={() => setWarehouseId(w._id)} />
        ))}
      </ScrollView>
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto o SKU…" />
      {canMove ? (
        <TouchableOpacity
          style={[styles.primary, { backgroundColor: palette.brand }]}
          onPress={() => navigation.navigate('StockMovementForm', warehouseId ? { warehouseId } : undefined)}
          accessibilityRole="button">
          <Text style={styles.primaryText}>Registrar movimiento</Text>
        </TouchableOpacity>
      ) : null}
      {error && balances.length > 0 ? <Text style={[styles.inlineError, { color: palette.danger }]}>{error}</Text> : null}
    </View>
  );

  const footer = movements.length > 0 ? (
    <View style={styles.footer}>
      <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Últimos movimientos</Text>
      {movements.map((m) => (
        <View key={m._id} style={[styles.movement, { borderBottomColor: palette.borderStrong }]}>
          <View style={styles.flex}>
            <Text style={[styles.movementTitle, { color: palette.textPrimary }]} numberOfLines={1}>
              {productName.get(m.productId) ?? 'Producto'}
            </Text>
            <Text style={[styles.movementMeta, { color: palette.textSecondary }]} numberOfLines={1}>
              {STOCK_MOVEMENT_LABELS[m.type]} · {warehouseName.get(m.warehouseId) ?? ''} · {new Date(m.createdAt).toLocaleDateString('es-MX')}
            </Text>
          </View>
          <Text style={[styles.movementQty, { color: m.direction === 'IN' ? palette.success : palette.danger }]}>
            {m.direction === 'IN' ? '+' : '−'}{formatQuantity(m.quantity)}
          </Text>
        </View>
      ))}
    </View>
  ) : undefined;

  const renderBody = () => {
    if (loading && balances.length === 0) return <LoadingState label="Cargando existencias…" />;
    if (error && balances.length === 0 && warehouses.length === 0) {
      return <ErrorState title="No se pudieron cargar las existencias" detail={error} onRetry={() => { setLoading(true); void load(); }} />;
    }
    return (
      <FlatList
        data={grouped}
        keyExtractor={(item) => item.product._id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={palette.accent} colors={[palette.accent]} />}
        ListEmptyComponent={
          <EmptyState
            title="Sin existencias"
            detail={warehouses.length === 0 ? 'Aún no hay almacenes. Créalos desde la Web.' : 'No hay existencias con los filtros actuales.'}
          />
        }
        renderItem={({ item }) => {
          const low = item.product.minimumStock > 0 && item.total < item.product.minimumStock;
          return (
            <Card style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.flex}>
                  <Text style={[styles.productName, { color: palette.textPrimary }]} numberOfLines={1}>{item.product.name}</Text>
                  <Text style={[styles.productMeta, { color: palette.textSecondary }]}>SKU {item.product.sku}</Text>
                </View>
                <View style={styles.totalBox}>
                  <Text style={[styles.total, { color: palette.textPrimary }]}>{formatQuantity(item.total)}</Text>
                  <Text style={[styles.unit, { color: palette.textSecondary }]}>{item.product.unit}</Text>
                </View>
              </View>
              {low ? <StatusBadge label={`Bajo mínimo (${item.product.minimumStock})`} tone="warning" /> : null}
              {item.rows.length > 1 || !warehouseId
                ? item.rows.map((row) => (
                    <Text key={row._id} style={[styles.row, { color: palette.textSecondary }]}>
                      {warehouseName.get(row.warehouseId) ?? 'Almacén'}: {formatQuantity(row.quantity)}
                    </Text>
                  ))
                : null}
            </Card>
          );
        }}
      />
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar title="Existencias" subtitle="Saldos por almacén" showBack onBack={() => navigation.goBack()} userName={userName} />
      <View style={styles.body}>{renderBody()}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  list: { gap: spacing.sm, paddingBottom: spacing.xxxl },
  headerBlock: { gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  primary: { borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  inlineError: { fontSize: 13 },
  card: { gap: spacing.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  productName: { fontSize: 16, fontWeight: '700' },
  productMeta: { fontSize: 12, marginTop: 2 },
  totalBox: { alignItems: 'flex-end' },
  total: { fontSize: 22, fontWeight: '800' },
  unit: { fontSize: 12 },
  row: { fontSize: 13 },
  footer: { marginTop: spacing.lg, gap: spacing.xs },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: spacing.xs },
  movement: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, gap: spacing.md },
  movementTitle: { fontSize: 14, fontWeight: '600' },
  movementMeta: { fontSize: 12, marginTop: 2 },
  movementQty: { fontSize: 16, fontWeight: '800' },
});

import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SearchBar, ResultCount } from '../components/SearchBar';
import { ListItem } from '../components/ListItem';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { Card } from '../components/Card';
import { unreadAlertsCount } from '../data/alerts';
import { MODULE_ACCESS, hasAnyPermission } from '../navigation/moduleAccess';
import {
  friendlyMessage,
  inventoryApi,
  loadSession,
  type Product,
} from '../lib/api';

/** Same page size as the Web inventory screen. */
const PAGE_LIMIT = 100;

export function InventoryScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName, me } = useAuth();
  const navigation = useAppNavigation();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissions = me?.permissions ?? [];
  const canCreate = hasAnyPermission(permissions, MODULE_ACCESS.inventoryCreate);
  const canEdit = hasAnyPermission(permissions, MODULE_ACCESS.inventoryUpdate);

  const loadProducts = useCallback(async () => {
    setError(null);

    try {
      const session = await loadSession();

      if (!session?.accessToken) {
        setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
        setProducts([]);
        return;
      }

      const [page, categories] = await Promise.all([
        inventoryApi.listProductsPage(session.accessToken, { limit: PAGE_LIMIT }),
        inventoryApi.listCategories(session.accessToken).catch(() => []),
      ]);

      setProducts(page.items);
      setTotal(page.total);

      const names: Record<string, string> = {};

      for (const category of categories) {
        names[category._id] = category.name;
      }

      setCategoryNames(names);
    } catch (err) {
      // Keep the last list on screen; the inline error says it is stale.
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Every focus re-reads from the API, so changes made on Web appear here.
  useFocusEffect(
    useCallback(() => {
      void loadProducts();
    }, [loadProducts]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }, [loadProducts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (q.length === 0) {
      return products;
    }

    return products.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q),
    );
  }, [query, products]);

  const countText =
    total > products.length
      ? `${filtered.length} de ${products.length} cargados · ${total} en total`
      : `${filtered.length} de ${products.length} productos`;

  const renderContent = () => {
    if (loading && products.length === 0) {
      return <LoadingState label="Cargando productos…" />;
    }

    if (error && products.length === 0) {
      return (
        <ErrorState
          title="No se pudo cargar el inventario"
          detail={error}
          onRetry={() => {
            setLoading(true);
            void loadProducts();
          }}
        />
      );
    }

    return (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="Sin resultados"
            detail={
              products.length === 0
                ? 'Aún no hay productos registrados en tu empresa.'
                : 'Ajusta la búsqueda.'
            }
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.itemCard}>
            <ListItem
              title={item.name}
              subtitle={`SKU ${item.sku} · ${item.unit}${item.categoryId && categoryNames[item.categoryId] ? ` · ${categoryNames[item.categoryId]}` : ''}`}
              rightText={`$${Number(item.price).toFixed(2)}`}
              badgeLabel={item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              badgeTone={item.status === 'ACTIVE' ? 'success' : 'neutral'}
              showChevron={canEdit}
              onPress={
                canEdit
                  ? () => navigation.navigate('ProductForm', { productId: item._id })
                  : undefined
              }
            />
          </Card>
        )}
      />
    );
  };

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Inventario"
        subtitle="Productos y catálogo"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <View style={styles.body}>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Buscar por nombre o SKU…"
        />
        {canCreate ? (
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: palette.brand }]}
            onPress={() => navigation.navigate('ProductForm', undefined)}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>
              + Nuevo producto
            </Text>
          </TouchableOpacity>
        ) : null}
        <ResultCount text={countText} />
        {error && products.length > 0 ? (
          <Text accessibilityRole="alert" style={[styles.inlineError, { color: palette.danger }]}>
            {error}
          </Text>
        ) : null}
        {renderContent()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    flex: 1,
    padding: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  itemCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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

  inlineError: {
    fontSize: 13,
  },
});

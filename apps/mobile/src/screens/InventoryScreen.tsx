import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
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
import {
  friendlyMessage,
  inventoryApi,
  loadSession,
  type Product,
} from '../lib/api';

export function InventoryScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await loadSession();

      if (!session?.accessToken) {
        setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
        setProducts([]);
        return;
      }

      const [items, categories] = await Promise.all([
        inventoryApi.listProducts(session.accessToken, { limit: 100 }),
        inventoryApi.listCategories(session.accessToken).catch(() => []),
      ]);

      setProducts(Array.isArray(items) ? items : []);

      const names: Record<string, string> = {};

      for (const category of categories) {
        names[category._id] = category.name;
      }

      setCategoryNames(names);
    } catch (err) {
      setProducts([]);
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProducts();
    }, [loadProducts]),
  );

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

  const renderContent = () => {
    if (loading && products.length === 0) {
      return <LoadingState label="Cargando productos…" />;
    }

    if (error && products.length === 0) {
      return (
        <ErrorState
          title="No se pudo cargar el inventario"
          detail={error}
          onRetry={() => void loadProducts()}
        />
      );
    }

    return (
      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
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
              subtitle={`${item.sku}${item.categoryId && categoryNames[item.categoryId] ? ` · ${categoryNames[item.categoryId]}` : ''}`}
              rightText={`$${item.price.toFixed(2)}`}
              badgeLabel={item.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              badgeTone={item.status === 'ACTIVE' ? 'success' : 'neutral'}
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
        subtitle="Materiales y almacenes"
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
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: palette.brand }]}
          onPress={() => navigation.navigate('ProductForm')}
        >
          <Text style={styles.addButtonText}>
            + Nuevo producto
          </Text>
        </TouchableOpacity>
        <ResultCount
          text={`${filtered.length} de ${products.length} productos`}
        />
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
});

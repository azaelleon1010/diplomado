import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SearchBar, ResultCount } from '../components/SearchBar';
import { ListItem } from '../components/ListItem';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/States';
import { Card } from '../components/Card';
import { unreadAlertsCount } from '../data/alerts';
import { inventoryItems, warehouses } from '../data/inventory';
import type { StockState } from '../types';

const STOCK_META: Record<StockState, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  available: { label: 'Disponible', tone: 'success' },
  low: { label: 'Stock bajo', tone: 'warning' },
  out: { label: 'Agotado', tone: 'danger' },
};

const STATE_FILTERS = ['Todos', 'Disponible', 'Stock bajo', 'Agotado'] as const;
type StateFilter = (typeof STATE_FILTERS)[number];

const STATE_BY_FILTER: Record<StateFilter, StockState | null> = {
  Todos: null,
  Disponible: 'available',
  'Stock bajo': 'low',
  Agotado: 'out',
};

export function InventoryScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const [query, setQuery] = useState('');
  const [warehouse, setWarehouse] = useState<string>('Todos');
  const [stateFilter, setStateFilter] = useState<StateFilter>('Todos');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const wanted = STATE_BY_FILTER[stateFilter];
    return inventoryItems.filter((item) => {
      if (warehouse !== 'Todos' && item.warehouse !== warehouse) {
        return false;
      }
      if (wanted !== null && item.state !== wanted) {
        return false;
      }
      if (q.length === 0) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.warehouse.toLowerCase().includes(q)
      );
    });
  }, [query, warehouse, stateFilter]);

  const filterActive = warehouse !== 'Todos' || stateFilter !== 'Todos';
  const [showFilters, setShowFilters] = useState(false);

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
          placeholder="Buscar material, SKU o almacén…"
          onFilterPress={() => setShowFilters((v) => !v)}
          filterActive={filterActive}
        />
        {showFilters ? (
          <View style={styles.filterBlock}>
            <FlatList
              data={[...warehouses]}
              horizontal
              keyExtractor={(w) => w}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item }) => (
                <Chip label={item} selected={warehouse === item} onPress={() => setWarehouse(item)} />
              )}
            />
            <FlatList
              data={[...STATE_FILTERS]}
              horizontal
              keyExtractor={(s) => s}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              renderItem={({ item }) => (
                <Chip label={item} selected={stateFilter === item} onPress={() => setStateFilter(item)} />
              )}
            />
          </View>
        ) : null}
        <ResultCount
          text={`${filtered.length} de ${inventoryItems.length} materiales${warehouse !== 'Todos' ? ` · ${warehouse}` : ''}`}
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState title="Sin resultados" detail="Ajusta la búsqueda o los filtros." />
          }
          renderItem={({ item }) => {
            const meta = STOCK_META[item.state];
            return (
              <Card style={styles.itemCard}>
                <ListItem
                  title={item.name}
                  subtitle={`${item.sku} · ${item.warehouse}`}
                  rightText={`${item.stock} ${item.unit}`}
                  badgeLabel={meta.label}
                  badgeTone={meta.tone}
                />
              </Card>
            );
          }}
        />
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
  filterBlock: {
    gap: spacing.sm,
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.xxxl,
  },
  itemCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

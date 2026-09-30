import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/States';
import {
  alertCategories,
  alertsStore,
  markAlertRead,
  markAllAlertsRead,
  unreadAlertsCount,
} from '../data/alerts';
import type { AlertCategory } from '../types';

type Filter = AlertCategory | 'all';

export function AlertsScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const [filter, setFilter] = useState<Filter>('all');
  const [version, setVersion] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      setVersion((v) => v + 1);
    }, []),
  );
  void version;

  const filtered = useMemo(
    () => alertsStore.filter((a) => filter === 'all' || a.category === filter),
    [filter, version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const unread = unreadAlertsCount();

  const openDetail = (id: string) => {
    markAlertRead(id);
    setVersion((v) => v + 1);
    navigation.navigate('AlertDetail', { alertId: id });
  };

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Alertas"
        subtitle={unread > 0 ? `${unread} sin leer` : 'Todo al día'}
        userName={userName}
      />
      <View style={styles.body}>
        <FlatList
          data={[...alertCategories]}
          horizontal
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => (
            <Chip label={item.label} selected={filter === item.id} onPress={() => setFilter(item.id)} />
          )}
        />
        <SectionHeader
          title={`${filtered.length} alertas`}
          actionLabel={unread > 0 ? 'Marcar leídas' : undefined}
          onAction={
            unread > 0
              ? () => {
                  markAllAlertsRead();
                  setVersion((v) => v + 1);
                }
              : undefined
          }
        />
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState title="Sin alertas" detail="No hay alertas en esta categoría." />
          }
          renderItem={({ item }) => (
            <Card style={[styles.itemCard, item.read ? undefined : styles.unreadCard]}>
              <ListItem
                title={item.title}
                subtitle={`${item.detail} · ${item.time}`}
                icon="alerts"
                badgeLabel={item.read ? 'Leída' : 'Nueva'}
                badgeTone={item.read ? 'neutral' : item.tone}
                showChevron
                onPress={() => openDetail(item.id)}
              />
            </Card>
          )}
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
  unreadCard: {
    borderLeftWidth: 3,
  },
});

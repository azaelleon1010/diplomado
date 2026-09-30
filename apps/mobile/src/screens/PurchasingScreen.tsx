import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { unreadAlertsCount } from '../data/alerts';
import { purchaseOrders } from '../data/purchases';
import type { BadgeTone } from '../components/StatusBadge';

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Pendiente', tone: 'warning' },
  approved: { label: 'Aprobada', tone: 'info' },
  received: { label: 'Recibida', tone: 'success' },
};

export function PurchasingScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Compras"
        subtitle="Órdenes y proveedores"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <View style={styles.body}>
        <SectionHeader title="Órdenes de compra" />
        <FlatList
          data={purchaseOrders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status];
            return (
              <Card style={styles.itemCard}>
                <ListItem
                  title={`${item.id.toUpperCase()} · ${item.supplier}`}
                  subtitle={`${item.items} · ${item.eta}`}
                  rightText={item.total}
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

import React, { useCallback, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { MetricCard } from '../components/MetricCard';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { Chip } from '../components/Chip';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { unreadAlertsCount } from '../data/alerts';
import {
  financeApi,
  friendlyMessage,
  loadSession,
  type Account,
  type FinanceMovement,
  type FinanceTotals,
} from '../lib/api';

const KIND_FILTERS = [
  { id: 'INCOME', label: 'Ingresos' },
  { id: 'EXPENSE', label: 'Gastos' },
  { id: 'all', label: 'Todos' },
] as const;

type KindFilter = (typeof KIND_FILTERS)[number]['id'];

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function FinanceScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const [movements, setMovements] = useState<FinanceMovement[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [totals, setTotals] = useState<FinanceTotals>({ income: 0, expenses: 0, balance: 0 });
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await loadSession();
      if (!session?.accessToken) {
        setError('Tu sesión no está disponible. Inicia sesión nuevamente.');
        setMovements([]);
        return;
      }
      const [fetchedMovements, fetchedTotals, fetchedAccounts] = await Promise.all([
        financeApi.listMovements(session.accessToken, {
          kind: kindFilter === 'all' ? undefined : kindFilter,
          limit: 100,
        }),
        financeApi.totals(session.accessToken),
        financeApi.listAccounts(session.accessToken).catch(() => [] as Account[]),
      ]);
      setMovements(Array.isArray(fetchedMovements) ? fetchedMovements : []);
      setTotals(fetchedTotals);
      const accList = Array.isArray(fetchedAccounts) ? fetchedAccounts : [];
      setAccounts(accList);
      const names: Record<string, string> = {};
      for (const account of accList) names[account._id] = `${account.code} · ${account.name}`;
      setAccountNames(names);
    } catch (err) {
      setMovements([]);
      setError(friendlyMessage(err));
    } finally {
      setLoading(false);
    }
  }, [kindFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Finanzas"
        subtitle="Ingresos, gastos y balance"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.metrics}>
          <MetricCard
            metric={{ id: 'f-inc', label: 'Ingresos', value: money(totals.income), subtitle: 'Movimientos publicados', accent: 'success' }}
          />
          <MetricCard
            metric={{ id: 'f-exp', label: 'Gastos', value: money(totals.expenses), subtitle: 'Movimientos publicados', accent: 'danger' }}
          />
        </View>

        <Card>
          <SectionHeader title="Balance del período" />
          <StatusBadge label={money(totals.balance)} tone={totals.balance >= 0 ? 'success' : 'danger'} />
        </Card>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: palette.brand }]}
          onPress={() => navigation.navigate('FinanceMovementForm')}
          accessibilityRole="button"
          accessibilityLabel="Nuevo movimiento">
          <Text style={styles.addButtonText}>+ Nuevo movimiento</Text>
        </TouchableOpacity>

        <FlatList
          data={[...KIND_FILTERS]}
          horizontal
          keyExtractor={(f) => f.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }) => (
            <Chip label={item.label} selected={kindFilter === item.id} onPress={() => setKindFilter(item.id)} />
          )}
        />
        <SectionHeader title={`Movimientos (${movements.length})`} />
        {loading && movements.length === 0 ? (
          <LoadingState label="Cargando movimientos…" />
        ) : error && movements.length === 0 ? (
          <ErrorState title="No se pudo cargar finanzas" detail={error} onRetry={() => void loadData()} />
        ) : movements.length === 0 ? (
          <EmptyState title="Sin movimientos" detail="Registra el primer ingreso o gasto de tu empresa." />
        ) : (
          <Card style={styles.listCard}>
            {movements.map((m) => (
              <ListItem
                key={m._id}
                title={m.concept}
                subtitle={`${accountNames[m.accountId] ?? 'Cuenta'} · ${m.date}${m.status === 'VOIDED' ? ' · Anulado' : ''}`}
                rightText={`${m.kind === 'INCOME' ? '+' : '-'}${money(m.amount)}`}
                badgeLabel={m.kind === 'INCOME' ? 'Ingreso' : 'Egreso'}
                badgeTone={m.kind === 'INCOME' ? 'success' : 'danger'}
              />
            ))}
          </Card>
        )}
        <SectionHeader title={`Cuentas (${accounts.length})`} />
        <Card style={styles.listCard}>
          {accounts.slice(0, 5).map((account) => (
            <ListItem
              key={account._id}
              title={`${account.code} · ${account.name}`}
              subtitle={account.type}
              icon="finance"
              badgeLabel={account.status === 'ACTIVE' ? 'Activa' : 'Inactiva'}
              badgeTone={account.status === 'ACTIVE' ? 'success' : 'neutral'}
            />
          ))}
        </Card>
      </ScrollView>
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
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  addButton: {
    borderRadius: 10,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  chipRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

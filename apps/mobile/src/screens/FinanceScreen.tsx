import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { MetricCard } from '../components/MetricCard';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { unreadAlertsCount } from '../data/alerts';
import { financeSummary } from '../data/finance';

export function FinanceScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Finanzas"
        subtitle="Resumen inicial (mock)"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.metrics}>
          <MetricCard
            metric={{ id: 'f-pay', label: 'Cuentas por pagar', value: financeSummary.payable, subtitle: 'Vencen 7 días', accent: 'danger' }}
          />
          <MetricCard
            metric={{ id: 'f-rec', label: 'Cuentas por cobrar', value: financeSummary.receivable, subtitle: 'Esperado 15 días', accent: 'success' }}
          />
        </View>

        <Card>
          <SectionHeader title="Balance del período" />
          <StatusBadge label={financeSummary.balance} tone="success" />
        </Card>

        <SectionHeader title="Flujo reciente" />
        <Card style={styles.listCard}>
          {financeSummary.recentMovements.map((m) => (
            <ListItem
              key={m.id}
              title={m.label}
              subtitle={m.date}
              rightText={m.amount}
              badgeLabel={m.tone === 'success' ? 'Ingreso' : m.tone === 'danger' ? 'Egreso' : 'Info'}
              badgeTone={m.tone}
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
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

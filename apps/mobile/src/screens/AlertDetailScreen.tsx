import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { EmptyState } from '../components/States';
import { unreadAlertsCount, alertsStore } from '../data/alerts';
import type { RootStackParamList } from '../navigation/types';

type DetailRoute = RouteProp<RootStackParamList, 'AlertDetail'>;

const CATEGORY_LABEL: Record<string, string> = {
  inventory: 'Inventario',
  production: 'Producción',
  maintenance: 'Mantenimiento',
  purchasing: 'Compras',
  system: 'Sistema',
};

export function AlertDetailScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const route = useRoute<DetailRoute>();
  const alert = alertsStore.find((a) => a.id === route.params.alertId);

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Detalle de alerta"
        subtitle={alert !== undefined ? CATEGORY_LABEL[alert.category] : undefined}
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      {alert === undefined ? (
        <EmptyState title="Alerta no encontrada" detail="El identificador no existe en datos mock." />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <StatusBadge label={alert.read ? 'Leída' : 'Nueva'} tone={alert.read ? 'neutral' : alert.tone} />
            <Text style={[styles.title, { color: palette.textPrimary }]}>{alert.title}</Text>
            <Text style={[styles.detail, { color: palette.textSecondary }]}>{alert.detail}</Text>
            <Text style={[styles.time, { color: palette.textMuted }]}>{alert.time}</Text>
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  title: {
    fontSize: typography.h2.fontSize,
    fontWeight: typography.h2.fontWeight,
    marginTop: spacing.md,
  },
  detail: {
    fontSize: typography.body.fontSize,
    marginTop: spacing.sm,
  },
  time: {
    fontSize: typography.bodySmall.fontSize,
    marginTop: spacing.sm,
  },
});

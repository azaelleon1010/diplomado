import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { unreadAlertsCount } from '../data/alerts';

export function AboutScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Acerca de"
        subtitle="TramaTech ERP"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.logo, { backgroundColor: palette.brand }]}>
          <Text style={styles.logoText}>TT</Text>
        </View>
        <Text style={[styles.brand, { color: palette.textPrimary }]}>TramaTech ERP</Text>
        <Text style={[styles.slogan, { color: palette.accent }]}>La red que mueve tu producción.</Text>
        <Card>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Versión</Text>
            <StatusBadge label="0.1.0 · Fase 2 (mock)" tone="accent" />
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>Entorno</Text>
            <StatusBadge label="Planta MX-01" tone="neutral" />
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaLabel, { color: palette.textSecondary }]}>API</Text>
            <StatusBadge label="No conectada en esta fase" tone="warning" />
          </View>
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
    alignItems: 'stretch',
    gap: spacing.md,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
  },
  brand: {
    fontSize: typography.h1.fontSize,
    fontWeight: typography.h1.fontWeight,
    textAlign: 'center',
  },
  slogan: {
    fontSize: typography.body.fontSize,
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  metaLabel: {
    fontSize: typography.body.fontSize,
  },
});

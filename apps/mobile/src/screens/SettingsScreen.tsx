import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing } from '../theme/tokens';
import { useAuth } from '../auth/AuthContext';
import { useAppNavigation } from '../hooks/useAppNavigation';
import { TopBar } from '../components/TopBar';
import { SectionHeader } from '../components/SectionHeader';
import { ListItem } from '../components/ListItem';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { unreadAlertsCount } from '../data/alerts';

export function SettingsScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState(false);

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Configuración"
        subtitle="Preferencias locales"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Notificaciones" />
        <Card style={styles.listCard}>
          <ListItem
            title="Alertas push"
            subtitle={pushEnabled ? 'Activadas' : 'Desactivadas'}
            icon="alerts"
            rightText=""
          />
          <View style={styles.switchRow}>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: palette.disabled, true: palette.brand }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Activar alertas push"
            />
          </View>
        </Card>

        <SectionHeader title="Operación" />
        <Card style={styles.listCard}>
          <ListItem
            title="Modo sin conexión"
            subtitle={offlineMode ? 'Cola local activada (mock)' : 'Desactivado'}
            icon="operations"
            rightText=""
          />
          <View style={styles.switchRow}>
            <Switch
              value={offlineMode}
              onValueChange={setOfflineMode}
              trackColor={{ false: palette.disabled, true: palette.brand }}
              thumbColor="#FFFFFF"
              accessibilityLabel="Activar modo sin conexión"
            />
          </View>
        </Card>

        <SectionHeader title="Apariencia" />
        <Card style={styles.listCard}>
          <ListItem
            title="Tema"
            subtitle="Oscuro (principal)"
            icon="settings"
            badgeLabel="Dark"
            badgeTone="info"
          />
          <StatusBadge label="Light mode: disponible en fase posterior" tone="neutral" />
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
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  switchRow: {
    alignItems: 'flex-end',
    paddingVertical: spacing.sm,
  },
});

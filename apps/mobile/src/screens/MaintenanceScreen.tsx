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
import { EmptyState } from '../components/States';
import { unreadAlertsCount } from '../data/alerts';
import { maintenanceIssues } from '../data/maintenance';
import type { BadgeTone } from '../components/StatusBadge';
import type { Priority } from '../types';

const PRIORITY_META: Record<Priority, { label: string; tone: BadgeTone }> = {
  high: { label: 'Prioridad alta', tone: 'danger' },
  medium: { label: 'Prioridad media', tone: 'warning' },
  low: { label: 'Prioridad baja', tone: 'info' },
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierta',
  scheduled: 'Programada',
  in_progress: 'En curso',
};

export function MaintenanceScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();

  const open = maintenanceIssues.filter((i) => i.status !== 'scheduled');
  const scheduled = maintenanceIssues.filter((i) => i.status === 'scheduled');

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Mantenimiento"
        subtitle="Incidencias y equipos"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <FlatList
        data={[{ key: 'sections' }]}
        keyExtractor={(i) => i.key}
        contentContainerStyle={styles.content}
        renderItem={() => (
          <View style={styles.gap}>
            <SectionHeader title={`Incidencias abiertas (${open.length})`} />
            <Card style={styles.listCard}>
              {open.length === 0 ? (
                <EmptyState title="Sin incidencias" detail="No hay fallas abiertas." />
              ) : (
                open.map((issue) => {
                  const meta = PRIORITY_META[issue.priority];
                  return (
                    <ListItem
                      key={issue.id}
                      title={issue.equipment}
                      subtitle={`${issue.description} · ${STATUS_LABEL[issue.status]}`}
                      icon="maintenance"
                      badgeLabel={meta.label}
                      badgeTone={meta.tone}
                    />
                  );
                })
              )}
            </Card>
            <SectionHeader title={`Mantenimiento programado (${scheduled.length})`} />
            <Card style={styles.listCard}>
              {scheduled.map((issue) => (
                <ListItem
                  key={issue.id}
                  title={issue.equipment}
                  subtitle={`${issue.description}${issue.scheduledFor !== undefined ? ` · ${issue.scheduledFor}` : ''}`}
                  icon="maintenance"
                  badgeLabel="Programado"
                  badgeTone="info"
                />
              ))}
            </Card>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  gap: {
    gap: spacing.lg,
  },
  listCard: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});

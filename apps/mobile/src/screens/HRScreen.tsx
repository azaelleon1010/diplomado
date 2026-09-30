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
import { unreadAlertsCount } from '../data/alerts';
import { hrSummary, hrTeam } from '../data/hr';

export function HRScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName } = useAuth();
  const navigation = useAppNavigation();

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title="Recursos Humanos"
        subtitle="Turnos, asistencia y vacaciones"
        showBack
        onBack={() => navigation.goBack()}
        unreadAlerts={unreadAlertsCount()}
        onAlertsPress={() => navigation.navigate('Alerts')}
        userName={userName}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.metrics}>
          <MetricCard
            metric={{
              id: 'hr-vac',
              label: 'Vacaciones disponibles',
              value: `${hrSummary.vacationsAvailable} días`,
              subtitle: 'Período actual',
              accent: 'accent',
            }}
          />
          <MetricCard
            metric={{
              id: 'hr-shift',
              label: 'Turno actual',
              value: hrSummary.currentShift,
              subtitle: 'Matutino',
              accent: 'brand',
            }}
          />
          <MetricCard
            metric={{
              id: 'hr-att',
              label: 'Asistencia',
              value: hrSummary.attendanceRate,
              subtitle: 'Esta semana',
              accent: 'success',
            }}
          />
          <MetricCard
            metric={{
              id: 'hr-inc',
              label: 'Incidencias',
              value: String(hrSummary.openIncidents),
              subtitle: 'Abiertas',
              accent: 'warning',
            }}
          />
        </View>

        <SectionHeader title="Equipo del turno" />
        <Card style={styles.listCard}>
          {hrTeam.map((m) => (
            <ListItem
              key={m.id}
              title={m.name}
              subtitle={m.detail}
              avatarName={m.name}
              badgeLabel={m.present ? 'Presente' : 'Ausente'}
              badgeTone={m.present ? 'success' : 'neutral'}
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

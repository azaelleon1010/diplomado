import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
import { SectionHeader } from '../components/SectionHeader';
import { TopBar } from '../components/TopBar';
import { loadSession } from '../lib/api';
import {
  dashboardApi,
  dashboardAreaStateForMetrics,
  dashboardAreaStateForError,
  getVisibleDashboardAreas,
  type DashboardAreaId,
  type DashboardAreaState,
  type DashboardMetric,
} from '../lib/dashboard';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';

interface AreaViewState {
  state: DashboardAreaState;
  metrics?: DashboardMetric[];
}

const AREA_TITLES: Record<DashboardAreaId, string> = {
  inventory: 'Inventario',
  production: 'Producción',
  purchasing: 'Compras',
  maintenance: 'Mantenimiento',
  hr: 'Recursos Humanos',
  finance: 'Finanzas',
  system: 'Estado de API',
};

const BUSINESS_AREAS: readonly DashboardAreaId[] = ['inventory', 'production', 'purchasing', 'maintenance', 'hr', 'finance'];

function getAreaMetrics(area: DashboardAreaId, token: string, permissions: readonly string[]): Promise<DashboardMetric[]> {
  switch (area) {
    case 'inventory': return dashboardApi.inventory(token);
    case 'production': return dashboardApi.production(token);
    case 'purchasing': return dashboardApi.purchasing(token);
    case 'maintenance': return dashboardApi.maintenance(token);
    case 'hr': return dashboardApi.hr(token, permissions);
    case 'finance': return dashboardApi.finance(token);
    case 'system': return dashboardApi.system(token);
  }
}

function DashboardAreaCard({ area, value, onRetry }: { area: DashboardAreaId; value?: AreaViewState; onRetry: () => void }): React.JSX.Element {
  const { palette } = useTheme();
  const state = value?.state ?? 'loading';
  const metrics = value?.metrics ?? [];
  const system = area === 'system';

  return (
    <Card style={styles.areaCard}>
      <View style={styles.areaHeading}>
        <SectionHeader title={AREA_TITLES[area]} />
        {state === 'ready' ? <StatusBadge label={system ? 'Verificada' : 'Datos actuales'} tone={system ? 'success' : 'neutral'} /> : null}
      </View>
      {state === 'loading' ? <LoadingState label={`Cargando ${AREA_TITLES[area].toLowerCase()}…`} /> : null}
      {state === 'empty' ? <EmptyState title="Sin registros para mostrar" detail="La consulta terminó correctamente y no encontró registros en los estados resumidos." /> : null}
      {state === 'forbidden' ? <EmptyState title="Acceso restringido" detail="La API no autorizó la consulta para esta sesión." /> : null}
      {state === 'unavailable' ? <EmptyState title="Información no disponible" detail="La API actual no ofrece esta consulta o su total paginado." /> : null}
      {state === 'error' ? <ErrorState title="No se pudo cargar esta sección" detail="Revisa la conexión e inténtalo de nuevo." onRetry={onRetry} /> : null}
      {state === 'ready' ? (
        <View style={styles.metrics}>
          {metrics.map((metric) => <MetricCard key={metric.id} metric={metric} style={styles.metric} />)}
        </View>
      ) : null}
      {state === 'ready' && system ? <Text style={[styles.healthHint, { color: palette.textMuted }]}>Estado de proceso; no verifica MongoDB ni Redis.</Text> : null}
    </Card>
  );
}

export function HomeScreen(): React.JSX.Element {
  const { palette } = useTheme();
  const { userName, me } = useAuth();
  const permissions = me?.permissions ?? [];
  const permissionKey = permissions.join('\u0000');
  const visibleAreas = getVisibleDashboardAreas(permissions);
  const [areas, setAreas] = useState<Partial<Record<DashboardAreaId, AreaViewState>>>({});

  const loadArea = useCallback(async (area: DashboardAreaId) => {
    setAreas((current) => ({ ...current, [area]: { state: 'loading' } }));
    try {
      const session = await loadSession();
      if (!session?.accessToken) throw new Error('No active session');
      const metrics = await getAreaMetrics(area, session.accessToken, permissions);
      setAreas((current) => ({ ...current, [area]: { state: dashboardAreaStateForMetrics(metrics), metrics } }));
    } catch (error) {
      setAreas((current) => ({ ...current, [area]: { state: dashboardAreaStateForError(error) } }));
    }
  }, [permissionKey]);

  const refresh = useCallback(() => {
    for (const area of visibleAreas) void loadArea(area);
  }, [permissionKey, loadArea]);

  useEffect(() => {
    refresh();
  }, [permissionKey, refresh]);

  const visibleBusinessAreas = BUSINESS_AREAS.filter((area) => visibleAreas.includes(area));

  return (
    <View style={[styles.flex, { backgroundColor: palette.background }]}>
      <TopBar
        title={`Inicio, ${userName.split(' ')[0]}`}
        subtitle="Tu espacio de trabajo"
        userName={userName}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <View style={styles.introCopy}>
            <Text accessibilityRole="header" style={[styles.title, { color: palette.textPrimary }]}>Resumen operativo</Text>
            <Text style={[styles.detail, { color: palette.textSecondary }]}>Datos actuales de las áreas que puedes consultar.</Text>
          </View>
          <Button label="Actualizar" variant="secondary" onPress={refresh} style={styles.refreshButton} />
        </View>
        <View style={styles.areaList}>
          {visibleBusinessAreas.map((area) => <DashboardAreaCard key={area} area={area} value={areas[area]} onRetry={() => void loadArea(area)} />)}
          {visibleAreas.includes('system') ? <DashboardAreaCard key="system" area="system" value={areas.system} onRetry={() => void loadArea('system')} /> : null}
          {visibleBusinessAreas.length === 0 ? (
            <Card style={styles.emptyCard}>
              <EmptyState title="Dashboard disponible" detail="No hay áreas de negocio con permisos de lectura asignados a esta sesión." />
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  intro: { gap: spacing.md },
  introCopy: { gap: spacing.xs },
  title: { fontSize: typography.h2.fontSize, fontWeight: typography.h2.fontWeight },
  detail: { fontSize: typography.bodySmall.fontSize, lineHeight: typography.bodySmall.lineHeight },
  refreshButton: { alignSelf: 'flex-start', minWidth: 128, minHeight: 44 },
  areaList: { gap: spacing.md },
  areaCard: { gap: spacing.md },
  areaHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { minWidth: 136, flexBasis: '47%', borderRadius: radii.lg },
  healthHint: { fontSize: typography.caption.fontSize },
  emptyCard: { width: '100%' },
});

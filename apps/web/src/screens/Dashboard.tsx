import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native-web';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../components/Card';
import { MetricCard } from '../components/MetricCard';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { StatusBadge } from '../components/StatusBadge';
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

function AreaCard({ area, value, onRetry }: { area: DashboardAreaId; value?: AreaViewState; onRetry: () => void }): React.JSX.Element {
  const { semanticColors: color, spacing, typography } = useTheme();
  const state = value?.state ?? 'loading';
  const metrics = value?.metrics ?? [];
  const isSystem = area === 'system';

  return (
    <Card style={styles.areaCard}>
      <View style={styles.areaHeader}>
        <Text accessibilityRole="header" style={[styles.areaTitle, { color: color.textPrimary, fontSize: typography.h3.fontSize }]}>{AREA_TITLES[area]}</Text>
        {state === 'ready' ? <StatusBadge label={isSystem ? 'Verificada' : 'Datos actuales'} type={isSystem ? 'success' : 'neutral'} /> : null}
      </View>
      {state === 'loading' ? <LoadingState label={`Cargando ${AREA_TITLES[area].toLowerCase()}…`} /> : null}
      {state === 'empty' ? <EmptyState title="Sin registros para mostrar" detail="La consulta terminó correctamente y no encontró registros en los estados resumidos." /> : null}
      {state === 'forbidden' ? <EmptyState title="Acceso restringido" detail="La API no autorizó la consulta para esta sesión." /> : null}
      {state === 'unavailable' ? <EmptyState title="Información no disponible" detail="La API actual no ofrece esta consulta o su total paginado." /> : null}
      {state === 'error' ? <ErrorState title="No se pudo cargar esta sección" detail="Revisa la conexión e inténtalo de nuevo." onRetry={onRetry} /> : null}
      {state === 'ready' ? (
        <View style={[styles.metrics, { gap: spacing.md }]}>
          {metrics.map((metric) => (
            <View key={metric.id} style={styles.metricSlot}>
              <MetricCard label={metric.label} value={metric.value} subtitle={metric.subtitle} color={metric.accent === 'brand' ? color.primary : metric.accent === 'accent' ? color.secondary : color[metric.accent]} />
            </View>
          ))}
        </View>
      ) : null}
      {state === 'ready' && isSystem ? <Text style={[styles.systemHint, { color: color.textMuted }]}>Liveness de la API; no verifica MongoDB ni Redis.</Text> : null}
    </Card>
  );
}

export function DashboardScreen(): React.JSX.Element {
  const { semanticColors: color, spacing, typography } = useTheme();
  const [width, setWidth] = useState(() => typeof window === 'undefined' ? 1280 : window.innerWidth);
  const { permissions } = useAuth();
  const [areas, setAreas] = useState<Partial<Record<DashboardAreaId, AreaViewState>>>({});
  const permissionKey = permissions.join('\u0000');
  const visibleAreas = getVisibleDashboardAreas(permissions);
  const gutter = width < 768 ? spacing.lg : width < 1280 ? spacing.xxl : spacing.xxxl;

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const loadArea = useCallback(async (area: DashboardAreaId) => {
    setAreas((current) => ({ ...current, [area]: { state: 'loading' } }));
    try {
      const token = loadSession()?.accessToken;
      if (!token) throw new Error('No active session');
      const metrics = await getAreaMetrics(area, token, permissions);
      setAreas((current) => ({ ...current, [area]: { state: dashboardAreaStateForMetrics(metrics), metrics } }));
    } catch (error) {
      setAreas((current) => ({ ...current, [area]: { state: dashboardAreaStateForError(error) } }));
    }
  }, [permissionKey]);

  useEffect(() => {
    for (const area of visibleAreas) void loadArea(area);
  }, [permissionKey, loadArea]);

  const visibleBusinessAreas = BUSINESS_AREAS.filter((area) => visibleAreas.includes(area));

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: color.background }]} contentContainerStyle={[styles.content, { padding: gutter, gap: spacing.xl }]}>
      <View style={styles.pageHeader}>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={[styles.title, { color: color.textPrimary, fontSize: typography.h1.fontSize }]}>Resumen operativo</Text>
          <Text style={[styles.subtitle, { color: color.textSecondary, fontSize: typography.body.fontSize }]}>Indicadores actuales según tu acceso y los datos disponibles.</Text>
        </View>
      </View>

      <View style={[styles.grid, { gap: spacing.lg }]}>
        {visibleBusinessAreas.map((area) => (
          <AreaCard key={area} area={area} value={areas[area]} onRetry={() => void loadArea(area)} />
        ))}
        {visibleAreas.includes('system') ? <AreaCard key="system" area="system" value={areas.system} onRetry={() => void loadArea('system')} /> : null}
        {visibleBusinessAreas.length === 0 ? (
          <Card style={styles.welcomeCard}>
            <EmptyState title="Dashboard disponible" detail="No hay áreas de negocio con permisos de lectura asignados a esta sesión." />
          </Card>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, minHeight: 0 },
  content: { width: '100%', maxWidth: 1360, alignSelf: 'center' },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerCopy: { gap: 4 },
  title: { fontWeight: '700' },
  subtitle: { lineHeight: 21 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  areaCard: { flexGrow: 1, flexBasis: 350, minWidth: 290, maxWidth: 660, gap: 16 },
  areaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  areaTitle: { fontWeight: '600' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap' },
  metricSlot: { flexGrow: 1, flexBasis: 190, minWidth: 160 },
  systemHint: { fontSize: 11 },
  welcomeCard: { flexGrow: 1, flexBasis: 350, minWidth: 290 },
});

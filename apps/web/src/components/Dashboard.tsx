import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { MetricCard } from './MetricCard';

interface DashboardProps {
  currentPath: string;
}

// MOCK DATA - explícitamente identificado como datos de demostración
const MOCK_KPIs = [
  { label: 'Producción del día', value: '92.4%', subtitle: 'vs plan semanal', trend: 'up' as const, color: '#00FFCC' },
  { label: 'Órdenes activas', value: '18', subtitle: 'en proceso', trend: 'neutral' as const },
  { label: 'Máquinas operativas', value: '47 / 52', subtitle: 'disponibilidad', trend: 'down' as const },
  { label: 'Paros de producción', value: '3', subtitle: 'esta semana', trend: 'down' as const, color: '#EF4444' },
  { label: 'Inventario crítico', value: '8', subtitle: 'materiales bajos', trend: 'up' as const, color: '#F59E0B' },
  { label: 'Almacén ocupado', value: '82%', subtitle: 'capacidad', trend: 'neutral' as const },
];

export function Dashboard({ currentPath }: DashboardProps) {
  const t = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.title}>Centro de Operaciones</Text>
          <Text style={styles.subtitle}>Panel operativo TramaTech</Text>
        </View>
        <Text style={styles.badge}>MOCK DATA</Text>
      </View>

      <View style={styles.kpiGrid}>
        {MOCK_KPIs.map((kpi) => (
          <MetricCard key={kpi.label} {...kpi} />
        ))}
      </View>

      <View style={styles.widgets}>
        <View style={[styles.widget, { flex: 2 }]}>
          <Text style={styles.widgetTitle}>Producción vs Plan</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartText}>Gráfico de barras — Producción vs Planificado</Text>
            <Text style={styles.chartDetail}>MOCK: 92.4% del plan semanal</Text>
          </View>
        </View>
        <View style={[styles.widget, { flex: 1 }]}>
          <Text style={styles.widgetTitle}>Estado de Mantenimiento</Text>
          <View style={styles.statusPlaceholder}>
            <Text style={styles.statusText}>3 máquinas en mantenimiento</Text>
            <Text style={styles.statusDetail}>MOCK</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#0B0F1A',
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: "'IBM Plex Sans', sans-serif",
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
  },
  badge: {
    color: '#00FFCC',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: '#00FFCC15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#00FFCC40',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  widgets: {
    flexDirection: 'row',
    gap: 16,
  },
  widget: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 16,
    minHeight: 180,
  },
  widgetTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  chartPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 6,
    minHeight: 120,
  },
  chartText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  chartDetail: {
    color: '#4B5563',
    fontSize: 11,
    marginTop: 4,
    fontFamily: "'IBM Plex Mono', monospace",
  },
  statusPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 6,
    minHeight: 120,
  },
  statusText: {
    color: '#F1F5F9',
    fontSize: 14,
  },
  statusDetail: {
    color: '#00FFCC',
    fontSize: 10,
    marginTop: 4,
  },
});

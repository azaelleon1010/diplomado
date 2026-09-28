import React from 'react';
import { View, Text, StyleSheet } from 'react-native-web';
import { useTheme } from '../theme/Theme';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

export function MetricCard({ label, value, subtitle, trend, color }: MetricCardProps) {
  const t = useTheme();
  const trendColor = trend === 'up' ? '#22C55E' : trend === 'down' ? '#EF4444' : '#64748B';
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <View style={[styles.card, { borderLeftColor: color || t.colors.brand.primary }]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {trend && (
          <Text style={[styles.trend, { color: trendColor }]}>
            {trendIcon} {trend === 'up' ? '+' : trend === 'down' ? '' : ''}
          </Text>
        )}
      </View>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 3,
    minWidth: 180,
  },
  label: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    color: '#F1F5F9',
    fontSize: 28,
    fontWeight: '700',
    fontFamily: "'IBM Plex Mono', monospace",
    lineHeight: 1.1,
  },
  trend: {
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
});

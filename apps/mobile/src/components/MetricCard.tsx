import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';
import type { Metric } from '../types';

const ACCENT_KEYS = {
  brand: 'brand',
  accent: 'accent',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
} as const;

export function MetricCard({ metric, style }: { metric: Metric; style?: StyleProp<ViewStyle> }): React.JSX.Element {
  const { palette } = useTheme();
  const accentColor = palette[ACCENT_KEYS[metric.accent]];
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.borderStrong },
        style,
      ]}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <Text style={[styles.label, { color: palette.textSecondary }]} numberOfLines={1}>
        {metric.label}
      </Text>
      <Text style={[styles.value, { color: palette.textPrimary }]}>{metric.value}</Text>
      <Text style={[styles.subtitle, { color: palette.textMuted }]} numberOfLines={1}>
        {metric.subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    minWidth: 150,
    flexGrow: 1,
    flexBasis: '47%',
  },
  accentBar: {
    width: 28,
    height: 3,
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: typography.caption.fontSize,
    fontWeight: typography.caption.fontWeight,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: typography.kpi.fontSize,
    fontWeight: typography.kpi.fontWeight,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: typography.bodySmall.fontSize,
    marginTop: 2,
  },
});

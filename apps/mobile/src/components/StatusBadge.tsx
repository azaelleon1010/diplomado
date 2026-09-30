import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

const SOFT_KEYS = {
  success: 'successSoft',
  warning: 'warningSoft',
  danger: 'dangerSoft',
  info: 'infoSoft',
  accent: 'accentSoft',
  neutral: 'surfaceSecondary',
} as const;

const TEXT_KEYS = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  accent: 'accent',
  neutral: 'textSecondary',
} as const;

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: palette[SOFT_KEYS[tone]] }]}>
      <Text style={[styles.text, { color: palette[TEXT_KEYS[tone]] }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
  },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography, type StatusType } from '../theme/tokens';

export type BadgeTone = StatusType;

const SOFT_KEYS = {
  success: 'successSoft',
  warning: 'warningSoft',
  danger: 'dangerSoft',
  info: 'infoSoft',
  neutral: 'surfaceSecondary',
} as const;

const TEXT_KEYS = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'textSecondary',
} as const;

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: palette[SOFT_KEYS[tone]] }]}>
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

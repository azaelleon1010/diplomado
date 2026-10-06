import React from 'react';
import { StyleSheet, Text, View } from 'react-native-web';
import type { StatusType } from '../theme/tokens';
import { useTheme } from '../theme/Theme';

interface StatusBadgeProps {
  label: string;
  type?: StatusType;
}

export function StatusBadge({ label, type = 'neutral' }: StatusBadgeProps): React.JSX.Element {
  const { semanticColors: color, spacing, radii, typography } = useTheme();
  const foreground = type === 'neutral' ? color.textSecondary : color[type];
  const background = type === 'neutral' ? color.neutralSoft : color[`${type}Soft`];
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: background, borderRadius: radii.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 }]}>
      <Text style={{ color: foreground, fontSize: typography.caption.fontSize, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ badge: { alignSelf: 'flex-start' } });

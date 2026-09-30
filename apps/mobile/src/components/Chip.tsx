import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography } from '../theme/tokens';

export function Divider(): React.JSX.Element {
  const { palette } = useTheme();
  return <View style={[styles.divider, { backgroundColor: palette.borderStrong }]} />;
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps): React.JSX.Element {
  const { palette } = useTheme();
  const content = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected ? palette.brandSoft : palette.surface,
          borderColor: selected ? palette.brand : palette.borderStrong,
        },
      ]}>
      <Text
        style={[
          styles.chipText,
          { color: selected ? palette.accent : palette.textSecondary },
        ]}>
        {label}
      </Text>
    </View>
  );
  if (onPress === undefined) {
    return content;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  divider: {
    height: 1,
    width: '100%',
  },
  chip: {
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: typography.bodySmall.fontSize,
    fontWeight: '600',
  },
});

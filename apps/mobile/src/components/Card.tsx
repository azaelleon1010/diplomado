import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/Theme';
import { elevation, radii, shadows, spacing, type CardVariant } from '../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, variant = 'default', style }: CardProps): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: variant === 'elevated' ? palette.elevated : palette.surface,
          borderColor: variant === 'outlined' ? palette.textMuted : palette.borderStrong,
          elevation: variant === 'elevated' ? elevation.card : 0,
          ...(variant === 'elevated' ? shadows.card : {}),
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
});

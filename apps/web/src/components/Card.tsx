import React from 'react';
import { StyleSheet, View } from 'react-native-web';
import type { CardVariant } from '../theme/tokens';
import { useTheme } from '../theme/Theme';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: React.CSSProperties;
}

export function Card({ children, variant = 'default', style }: CardProps): React.JSX.Element {
  const { semanticColors: color, radii, spacing, elevation } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: variant === 'elevated' ? color.surfaceElevated : color.surface,
          borderColor: variant === 'outlined' ? color.textMuted : color.borderStrong,
          borderRadius: radii.lg,
          padding: spacing.lg,
          boxShadow: variant === 'elevated' ? elevation.card : 'none',
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ card: { borderWidth: 1 } });

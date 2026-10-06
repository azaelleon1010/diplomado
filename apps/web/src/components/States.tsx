import React from 'react';
import { StyleSheet, Text, View } from 'react-native-web';
import { useTheme } from '../theme/Theme';
import { Button } from './Button';

interface StateProps {
  title: string;
  detail?: string;
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }): React.JSX.Element {
  const { semanticColors: color, spacing, typography } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={[styles.state, { gap: spacing.sm }]}>
      <View style={[styles.spinner, { borderColor: `${color.secondary}55`, borderTopColor: color.secondary }]} />
      <Text style={{ color: color.textSecondary, fontSize: typography.body.fontSize }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, detail }: StateProps): React.JSX.Element {
  const { semanticColors: color, spacing, typography } = useTheme();
  return (
    <View style={[styles.state, { gap: spacing.sm }]}>
      <Text accessibilityRole="header" style={{ color: color.textPrimary, fontSize: typography.h3.fontSize, fontWeight: '600' }}>{title}</Text>
      {detail ? <Text style={{ color: color.textSecondary, fontSize: typography.body.fontSize, textAlign: 'center' }}>{detail}</Text> : null}
    </View>
  );
}

export function ErrorState({
  title,
  detail,
  retryLabel = 'Reintentar',
  onRetry,
}: StateProps & { retryLabel?: string; onRetry?: () => void }): React.JSX.Element {
  const { semanticColors: color, spacing, typography } = useTheme();
  return (
    <View accessibilityRole="alert" style={[styles.state, { gap: spacing.sm }]}>
      <Text accessibilityRole="header" style={{ color: color.danger, fontSize: typography.h3.fontSize, fontWeight: '600' }}>{title}</Text>
      {detail ? <Text style={{ color: color.textSecondary, fontSize: typography.body.fontSize, textAlign: 'center' }}>{detail}</Text> : null}
      {onRetry ? <Button label={retryLabel} onPress={onRetry} variant="secondary" style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  spinner: {
    width: 28,
    height: 28,
    borderWidth: 3,
    borderRadius: 9999,
    animationKeyframes: [{ '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }],
    animationDuration: '900ms',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
});

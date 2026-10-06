import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/Theme';
import { spacing, typography } from '../theme/tokens';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface StateProps {
  title: string;
  detail?: string;
  icon?: IconName;
}

function StateShell({ title, detail, icon }: StateProps): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <View style={styles.container}>
      {icon !== undefined ? (
        <View style={[styles.iconWrap, { backgroundColor: palette.surfaceSecondary }]}>
          <Icon name={icon} size="lg" color={palette.textMuted} />
        </View>
      ) : null}
      <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
      {detail !== undefined ? (
        <Text style={[styles.detail, { color: palette.textSecondary }]}>{detail}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState(props: StateProps): React.JSX.Element {
  return <StateShell {...props} icon={props.icon ?? 'search'} />;
}

export function LoadingState({ label = 'Cargando…' }: { label?: string }): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.container}>
      <ActivityIndicator size="large" color={palette.accent} />
      <Text style={[styles.detail, { color: palette.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  title = 'Algo salió mal',
  detail,
  retryLabel = 'Reintentar',
  onRetry,
}: StateProps & { retryLabel?: string; onRetry?: () => void }): React.JSX.Element {
  return (
    <View accessibilityRole="alert" style={styles.container}>
      <StateShell title={title} detail={detail} icon="alerts" />
      {onRetry !== undefined ? (
        <View style={styles.retry}>
          <Button label={retryLabel} onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.h3.fontSize,
    fontWeight: typography.h3.fontWeight,
    textAlign: 'center',
  },
  detail: {
    fontSize: typography.body.fontSize,
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing.md,
    minWidth: 160,
  },
});

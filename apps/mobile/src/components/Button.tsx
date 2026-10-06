import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography, type ButtonVariant } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps): React.JSX.Element {
  const { palette } = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? palette.brand
      : variant === 'danger'
        ? palette.danger
        : variant === 'secondary'
          ? palette.surfaceSecondary
          : 'transparent';

  const textColor =
    variant === 'primary'
      ? '#FFFFFF'
      : variant === 'danger'
        ? '#FFFFFF'
        : variant === 'secondary'
          ? palette.textPrimary
          : palette.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: variant === 'primary' && pressed ? palette.brandPressed : backgroundColor,
          borderColor: palette.borderStrong,
          opacity: isDisabled ? 0.55 : pressed && variant !== 'primary' ? 0.85 : 1,
        },
        variant === 'ghost' && styles.ghost,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon !== undefined ? <Icon name={icon} size="sm" color={textColor} /> : null}
          <Text style={[styles.label, { color: textColor }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  label: string;
  badgeCount?: number;
  disabled?: boolean;
}

export function IconButton({ icon, onPress, label, badgeCount, disabled = false }: IconButtonProps): React.JSX.Element {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: palette.surfaceSecondary, opacity: disabled ? 0.55 : pressed ? 0.7 : 1 },
      ]}>
      <Icon name={icon} size="md" color={palette.textPrimary} />
      {badgeCount !== undefined && badgeCount > 0 ? (
        <Text style={[styles.badge, { backgroundColor: palette.danger }]}>
          {badgeCount > 9 ? '9+' : String(badgeCount)}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  ghost: {
    borderWidth: 1,
  },
  label: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingHorizontal: 4,
  },
});

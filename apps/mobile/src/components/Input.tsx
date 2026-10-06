import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../theme/Theme';
import { radii, spacing, typography, type InputState } from '../theme/tokens';

interface InputProps extends TextInputProps {
  label: string;
  error?: string;
  state?: InputState;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  rightAccessory?: React.ReactNode;
}

export function Input({
  label,
  error,
  state = 'default',
  hint,
  loading = false,
  editable = true,
  disabled = false,
  containerStyle,
  inputStyle,
  rightAccessory,
  accessibilityLabel,
  accessibilityHint,
  onFocus,
  onBlur,
  ...inputProps
}: InputProps): React.JSX.Element {
  const { palette } = useTheme();
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || !editable || state === 'disabled' || loading;
  const hasError = state === 'error' || Boolean(error);
  const message = error || hint;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, { color: palette.textSecondary }]}>{label}</Text>
      <View style={[
        styles.control,
        {
          backgroundColor: palette.backgroundSecondary,
          borderColor: hasError ? palette.danger : focused ? palette.accent : palette.borderStrong,
          opacity: unavailable ? 0.58 : 1,
        },
      ]}>
        <TextInput
          {...inputProps}
          editable={!unavailable}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={error ? `Error: ${error}` : accessibilityHint ?? hint}
          accessibilityState={{ disabled: unavailable, busy: loading }}
          onFocus={(event) => { setFocused(true); onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); onBlur?.(event); }}
          placeholderTextColor={palette.textMuted}
          style={[styles.input, { color: palette.textPrimary }, inputStyle]}
        />
        {loading ? <ActivityIndicator size="small" color={palette.accent} /> : rightAccessory}
      </View>
      {message ? (
        <Text
          accessibilityRole={hasError ? 'alert' : undefined}
          style={[styles.message, { color: hasError ? palette.danger : palette.textMuted }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
  },
  control: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize,
  },
  message: {
    fontSize: typography.caption.fontSize,
    lineHeight: 16,
  },
});

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native-web';
import { useTheme } from '../theme/Theme';
import type { InputState } from '../theme/tokens';

export interface InputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoCapitalize?: string;
  autoCorrect?: boolean;
  autoComplete?: string;
  keyboardType?: string;
  secureTextEntry?: boolean;
  returnKeyType?: string;
  onSubmitEditing?: () => void;
  disabled?: boolean;
  state?: InputState;
  error?: string;
  hint?: string;
  loading?: boolean;
  inputStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  rightAccessory?: React.ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Input({
  label,
  value,
  onChangeText,
  error,
  hint,
  loading = false,
  disabled = false,
  state = 'default',
  inputStyle,
  containerStyle,
  rightAccessory,
  accessibilityLabel,
  accessibilityHint,
  autoCapitalize,
  autoCorrect,
  autoComplete,
  keyboardType,
  secureTextEntry,
  returnKeyType,
  onSubmitEditing,
  placeholder,
  ...inputProps
}: InputProps): React.JSX.Element {
  const { semanticColors: color, spacing, radii, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const unavailable = disabled || state === 'disabled' || loading;
  const hasError = state === 'error' || Boolean(error);
  const message = error || hint;

  return (
    <View style={[styles.container, { gap: spacing.xs }, containerStyle]}>
      <Text style={[styles.label, { color: color.textSecondary, fontSize: typography.label.fontSize }]}>{label}</Text>
      <View style={[
        styles.control,
        {
          backgroundColor: color.inputSurface,
          borderColor: hasError ? color.danger : focused ? color.secondary : color.borderStrong,
          borderRadius: radii.md,
          minHeight: 48,
          opacity: unavailable ? 0.58 : 1,
        },
      ]}>
        <TextInput
          {...inputProps}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!unavailable}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={error ? `Error: ${error}` : accessibilityHint ?? hint}
          accessibilityState={{ disabled: unavailable }}
          aria-invalid={hasError}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={color.textMuted}
          style={[styles.input, { color: color.textPrimary, fontSize: typography.body.fontSize }, inputStyle]}
        />
        {loading ? <View accessibilityRole="progressbar" style={[styles.spinner, { borderColor: `${color.secondary}55`, borderTopColor: color.secondary }]} /> : rightAccessory}
      </View>
      {message ? (
        <Text
          accessibilityRole={hasError ? 'alert' : undefined}
          style={[styles.message, { color: hasError ? color.danger : color.textMuted, fontSize: typography.caption.fontSize }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  label: { fontWeight: '600' },
  control: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingVertical: 10,
    outlineStyle: 'none',
  } as never,
  message: { lineHeight: 16 },
  spinner: {
    width: 16,
    height: 16,
    borderWidth: 2,
    borderRadius: 9999,
    animationKeyframes: [{ '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } }],
    animationDuration: '900ms',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
});

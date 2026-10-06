import React, { useState } from 'react';
import type { ButtonVariant } from '../theme/tokens';
import { useTheme } from '../theme/Theme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  style?: React.CSSProperties;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  accessibilityLabel,
  style,
}: ButtonProps): React.JSX.Element {
  const { semanticColors: color, spacing, radii, typography, motion } = useTheme();
  const [interaction, setInteraction] = useState<'idle' | 'hover' | 'pressed'>('idle');
  const unavailable = disabled || loading;
  const baseBackgroundColor = variant === 'primary'
    ? color.primary
    : variant === 'danger'
      ? color.danger
      : variant === 'secondary'
        ? color.neutralSoft
        : 'transparent';
  const backgroundColor = variant === 'primary' && !unavailable
    ? interaction === 'pressed'
      ? color.primaryPressed
      : interaction === 'hover'
        ? color.primaryHover
        : color.primary
    : variant === 'secondary' && interaction === 'hover' && !unavailable
      ? color.surfaceElevated
      : baseBackgroundColor;
  const foregroundColor = variant === 'primary' || variant === 'danger'
    ? '#FFFFFF'
    : variant === 'ghost'
      ? color.secondary
      : color.textPrimary;

  return (
    <button
      type="button"
      onClick={onPress}
      disabled={unavailable}
      aria-label={accessibilityLabel ?? label}
      aria-disabled={unavailable}
      aria-busy={loading}
      onMouseEnter={() => setInteraction('hover')}
      onMouseLeave={() => setInteraction('idle')}
      onMouseDown={() => setInteraction('pressed')}
      onMouseUp={() => setInteraction('hover')}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') setInteraction('pressed');
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') setInteraction('hover');
      }}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        display: 'flex',
        flexDirection: 'row',
        gap: spacing.sm,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: variant === 'ghost' ? color.borderStrong : backgroundColor,
        backgroundColor,
        borderRadius: radii.lg,
        minHeight: 48,
        paddingBlock: 12,
        paddingInline: spacing.lg,
        opacity: unavailable ? 0.56 : 1,
        cursor: unavailable ? 'not-allowed' : 'pointer',
        fontFamily: typography.fontFamily,
        transition: `opacity ${motion.fast}ms ease`,
        ...style,
      }}>
        {loading ? (
          <span
            role="progressbar"
            aria-label="Cargando"
            style={{
              width: 16,
              height: 16,
              border: `2px solid ${foregroundColor}55`,
              borderTopColor: foregroundColor,
              borderRadius: '50%',
              animation: 'ds-spin 900ms linear infinite',
            }}
          />
        ) : null}
        {icon}
        <span style={{ color: foregroundColor, fontSize: typography.body.fontSize, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

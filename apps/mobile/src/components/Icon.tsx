import React from 'react';
import { Text, type TextStyle } from 'react-native';
import { useTheme } from '../theme/Theme';
import { iconSizes, type IconSizeKey } from '../theme/tokens';

/**
 * Enterprise glyph icon set. Monochrome text glyphs (no emoji, no native
 * icon dependency) rendered through the system font for consistency.
 */
export type IconName =
  | 'home'
  | 'assistant'
  | 'operations'
  | 'alerts'
  | 'more'
  | 'back'
  | 'next'
  | 'search'
  | 'bell'
  | 'close'
  | 'check'
  | 'plus'
  | 'filter'
  | 'production'
  | 'inventory'
  | 'maintenance'
  | 'purchasing'
  | 'hr'
  | 'finance'
  | 'settings'
  | 'user'
  | 'logout'
  | 'info';

const GLYPHS: Record<IconName, string> = {
  home: '⌂',
  assistant: '◐',
  operations: '◫',
  alerts: '▲',
  more: '⋮',
  back: '‹',
  next: '›',
  search: '⌕',
  bell: '◉',
  close: '✕',
  check: '✓',
  plus: '+',
  filter: '▼',
  production: '▶',
  inventory: '□',
  maintenance: '⚙',
  purchasing: '≡',
  hr: '●',
  finance: '$',
  settings: '○',
  user: '◍',
  logout: '›',
  info: 'i',
};

interface IconProps {
  name: IconName;
  size?: IconSizeKey | number;
  color?: string;
  style?: TextStyle;
}

export function Icon({ name, size = 'md', color, style }: IconProps): React.JSX.Element {
  const { palette } = useTheme();
  const fontSize = typeof size === 'number' ? size : iconSizes[size];
  return (
    <Text style={[{ fontSize, color: color ?? palette.textSecondary }, style]}>
      {GLYPHS[name]}
    </Text>
  );
}

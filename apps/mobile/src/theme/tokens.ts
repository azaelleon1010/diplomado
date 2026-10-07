/**
 * TramaTech ERP — Design tokens (mobile).
 *
 * Brand: Cobalt #0047AB · Neon Cyan #00FFCC · Slate #2F4F4F.
 * Cyan is an accent (CTA, AI, focus, indicators), never a dominant surface.
 * Dark mode is the primary experience; `lightPalette` keeps the same shape
 * so light mode can be enabled later without touching components.
 */

export interface Palette {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceSecondary: string;
  elevated: string;
  overlay: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  brand: string;
  brandDeep: string;
  brandPressed: string;
  brandSoft: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  disabled: string;
}

export type ThemeScheme = 'dark' | 'light';

/** Keep semantic values and variant names aligned with apps/web/src/theme/tokens.ts. */
export const semanticColors = {
  background: '#0B0F1A',
  inputSurface: '#111827',
  surface: '#1E293B',
  surfaceElevated: '#2D3F56',
  border: '#2F4F4F',
  borderStrong: '#374151',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#0047AB',
  primaryHover: '#003380',
  primaryPressed: '#002966',
  secondary: '#00FFCC',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.12)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  info: '#38BDF8',
  infoSoft: 'rgba(56, 189, 248, 0.12)',
  neutralSoft: '#253347',
  disabled: '#4B5563',
} as const;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type InputState = 'default' | 'error' | 'disabled';
export type CardVariant = 'default' | 'elevated' | 'outlined';
export type StatusType = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export const darkPalette: Palette = {
  background: semanticColors.background,
  backgroundSecondary: semanticColors.inputSurface,
  surface: semanticColors.surface,
  surfaceSecondary: semanticColors.neutralSoft,
  elevated: semanticColors.surfaceElevated,
  overlay: 'rgba(11, 15, 26, 0.72)',
  border: semanticColors.border,
  borderStrong: semanticColors.borderStrong,
  textPrimary: semanticColors.textPrimary,
  textSecondary: semanticColors.textSecondary,
  textMuted: semanticColors.textMuted,
  textInverse: '#0B0F1A',
  brand: semanticColors.primary,
  brandDeep: semanticColors.primaryHover,
  brandPressed: semanticColors.primaryPressed,
  brandSoft: 'rgba(0, 71, 171, 0.16)',
  accent: semanticColors.secondary,
  accentSoft: 'rgba(0, 255, 204, 0.12)',
  success: semanticColors.success,
  successSoft: semanticColors.successSoft,
  warning: semanticColors.warning,
  warningSoft: semanticColors.warningSoft,
  danger: semanticColors.danger,
  dangerSoft: semanticColors.dangerSoft,
  info: semanticColors.info,
  infoSoft: semanticColors.infoSoft,
  disabled: semanticColors.disabled,
};

export const lightPalette: Palette = {
  background: '#F1F5F9',
  backgroundSecondary: '#E2E8F0',
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  elevated: '#FFFFFF',
  overlay: 'rgba(11, 15, 26, 0.45)',
  border: '#CBD5E1',
  borderStrong: '#94A3B8',
  textPrimary: '#0B0F1A',
  textSecondary: '#2F4F4F',
  textMuted: '#64748B',
  textInverse: '#F1F5F9',
  brand: '#0047AB',
  brandDeep: '#003380',
  brandPressed: '#002966',
  brandSoft: 'rgba(0, 71, 171, 0.10)',
  accent: '#007A66',
  accentSoft: 'rgba(0, 122, 102, 0.10)',
  success: '#15803D',
  successSoft: 'rgba(21, 128, 61, 0.10)',
  warning: '#B45309',
  warningSoft: 'rgba(180, 83, 9, 0.10)',
  danger: '#B91C1C',
  dangerSoft: 'rgba(185, 28, 28, 0.10)',
  info: '#0369A1',
  infoSoft: 'rgba(3, 105, 161, 0.10)',
  disabled: '#94A3B8',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 48,
} as const;

export type SpacingKey = keyof typeof spacing;

export const radii = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
  small: 4,
  medium: 6,
  large: 12,
  pill: 9999,
} as const;

export type RadiiKey = keyof typeof radii;

export interface TextStyleDef {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
  fontFamily?: string;
}

export const typography: Record<
  'display' | 'h1' | 'h2' | 'h3' | 'title' | 'body' | 'bodySmall' | 'caption' | 'label' | 'numeric' | 'data' | 'kpi',
  TextStyleDef
> = {
  display: { fontSize: 32, fontWeight: '700', lineHeight: 38 },
  h1: { fontSize: 24, fontWeight: '700', lineHeight: 31 },
  h2: { fontSize: 20, fontWeight: '600', lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  title: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 21 },
  bodySmall: { fontSize: 12, fontWeight: '400', lineHeight: 17 },
  caption: { fontSize: 11, fontWeight: '500', lineHeight: 14 },
  label: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
  numeric: { fontSize: 14, fontWeight: '500', lineHeight: 21, fontFamily: 'monospace' },
  data: { fontSize: 14, fontWeight: '500', lineHeight: 21, fontFamily: 'monospace' },
  kpi: { fontSize: 28, fontWeight: '700', lineHeight: 31 },
};

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export const breakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
} as const;

export const motion = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

export type IconSizeKey = keyof typeof iconSizes;

/** Android elevation scale (shadows are elevation-based on Android). */
export const elevation = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 8,
  card: 2,
  surface: 4,
  modal: 8,
  drawer: 8,
} as const;

export type ElevationKey = keyof typeof elevation;

/** iOS shadow counterparts; Android reads the elevation values above. */
export const shadows = {
  card: { shadowColor: '#000000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.16, shadowRadius: 4 },
  surface: { shadowColor: '#000000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  modal: { shadowColor: '#000000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.3, shadowRadius: 24 },
  drawer: { shadowColor: '#000000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.24, shadowRadius: 16 },
} as const;

export function getPalette(scheme: ThemeScheme): Palette {
  return scheme === 'light' ? lightPalette : darkPalette;
}

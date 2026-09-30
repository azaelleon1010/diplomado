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

export const darkPalette: Palette = {
  background: '#0B0F1A',
  backgroundSecondary: '#111827',
  surface: '#1E293B',
  surfaceSecondary: '#253347',
  elevated: '#2D3F56',
  overlay: 'rgba(11, 15, 26, 0.72)',
  border: '#2F4F4F',
  borderStrong: '#374151',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#0B0F1A',
  brand: '#0047AB',
  brandDeep: '#003380',
  brandSoft: 'rgba(0, 71, 171, 0.16)',
  accent: '#00FFCC',
  accentSoft: 'rgba(0, 255, 204, 0.12)',
  success: '#22C55E',
  successSoft: 'rgba(34, 197, 94, 0.12)',
  warning: '#F59E0B',
  warningSoft: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  info: '#38BDF8',
  infoSoft: 'rgba(56, 189, 248, 0.12)',
  disabled: '#4B5563',
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
} as const;

export type SpacingKey = keyof typeof spacing;

export const radii = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

export type RadiiKey = keyof typeof radii;

export interface TextStyleDef {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
}

export const typography: Record<
  'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySmall' | 'caption' | 'numeric' | 'kpi',
  TextStyleDef
> = {
  display: { fontSize: 30, fontWeight: '700', lineHeight: 36 },
  h1: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  h2: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  h3: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: '400', lineHeight: 17 },
  caption: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  numeric: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  kpi: { fontSize: 26, fontWeight: '700', lineHeight: 30 },
};

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

export type IconSizeKey = keyof typeof iconSizes;

/** Android elevation scale (shadows are elevation-based on Android). */
export const elevation = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 8,
} as const;

export type ElevationKey = keyof typeof elevation;

export function getPalette(scheme: ThemeScheme): Palette {
  return scheme === 'light' ? lightPalette : darkPalette;
}

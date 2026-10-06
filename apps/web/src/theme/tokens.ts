/**
 * TramaTech Design Tokens
 *
 * Branding: Cobalt #0047AB, Neon Cyan #00FFCC, Slate #2F4F4F
 *
 * All colors derive from these three primaries.
 * Cyan (#00FFCC) is reserved for: CTA, AI accent, active special, focus, indicators.
 * Cobalt (#0047AB) is the primary brand/nav color.
 * Slate (#2F4F4F) is the dark surface base.
 */

export const colors = {
  // Primary brand
  brand: {
    primary: '#0047AB',       // Cobalt
    secondary: '#00FFCC',     // Neon Cyan
    dark: '#2F4F4F',          // Slate
  },
  // Backgrounds
  background: {
    primary: '#0B0F1A',       // Deep dark
    secondary: '#111827',     // Dark surface
    tertiary: '#1A2332',      // Elevated surface
    card: '#1E293B',          // Card surface
  },
  // Surfaces
  surface: {
    primary: '#1E293B',
    secondary: '#253347',
    elevated: '#2D3F56',
    overlay: '#0B0F1CC0',
  },
  // Borders
  border: {
    primary: '#2F4F4F',
    secondary: '#374151',
    focus: '#00FFCC',
  },
  // Text
  text: {
    primary: '#F1F5F9',
    secondary: '#94A3B8',
    muted: '#64748B',
    inverse: '#0B0F1A',
    brand: '#0047AB',
    ai: '#00FFCC',
  },
  // Status
  status: {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#38BDF8',
    disabled: '#4B5563',
  },
  // Sidebar specific
  sidebar: {
    background: '#0B0F1A',
    surface: '#111827',
    hover: '#1A2332',
    active: '#0047AB',
    activeBg: '#0047AB20',
    border: '#1F2937',
  },
} as const;

/** Semantic color contract mirrored by apps/mobile/src/theme/tokens.ts. */
export const semanticColors = {
  background: '#0B0F1A',
  surface: '#1E293B',
  inputSurface: '#111827',
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

export const iconSizes = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

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

export const elevation = {
  card: '0 2px 8px rgba(0, 0, 0, 0.16)',
  surface: '0 4px 16px rgba(0, 0, 0, 0.20)',
  modal: '0 16px 48px rgba(0, 0, 0, 0.36)',
  drawer: '0 8px 28px rgba(0, 0, 0, 0.30)',
} as const;

export const sidebar = {
  expanded: 260,
  collapsed: 64,
  transition: 'width 0.2s ease',
} as const;

export const breakpoints = {
  mobile: 768,
  tablet: 1024,
  desktop: 1280,
} as const;

export const layout = {
  pageMaxWidth: 1280,
  gutterMobile: spacing.lg,
  gutterTablet: spacing.xxl,
  gutterDesktop: spacing.xxxl,
} as const;

export const zIndex = {
  sidebar: 100,
  topbar: 90,
  commandPalette: 200,
  drawer: 150,
  toast: 300,
} as const;

export const typography = {
  fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  fontFamilyMono: "'IBM Plex Mono', monospace",
  display: { fontSize: 32, weight: 700, lineHeight: 1.2 },
  h1: { fontSize: 24, weight: 700, lineHeight: 1.3 },
  h2: { fontSize: 20, weight: 600, lineHeight: 1.3 },
  h3: { fontSize: 16, weight: 600, lineHeight: 1.4 },
  title: { fontSize: 18, weight: 600, lineHeight: 1.35 },
  body: { fontSize: 14, weight: 400, lineHeight: 1.5 },
  bodySmall: { fontSize: 12, weight: 400, lineHeight: 1.4 },
  caption: { fontSize: 11, weight: 500, lineHeight: 1.3 },
  label: { fontSize: 12, weight: 500, lineHeight: 1.35 },
  numeric: { fontSize: 14, weight: 500, lineHeight: 1.5, fontFamily: "'IBM Plex Mono', monospace" },
  data: { fontSize: 14, weight: 500, lineHeight: 1.5, fontFamily: "'IBM Plex Mono', monospace" },
  kpi: { fontSize: 28, weight: 700, lineHeight: 1.1 },
} as const;

export const motion = {
  fast: 150,
  normal: 200,
  slow: 300,
} as const;

export const transitions = {
  fast: `${motion.fast}ms ease`,
  normal: `${motion.normal}ms ease`,
  slow: `${motion.slow}ms ease`,
} as const;

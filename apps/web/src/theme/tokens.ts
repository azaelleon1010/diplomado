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
    info: '#0047AB',
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

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  full: 9999,
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
  body: { fontSize: 14, weight: 400, lineHeight: 1.5 },
  bodySmall: { fontSize: 12, weight: 400, lineHeight: 1.4 },
  caption: { fontSize: 11, weight: 500, lineHeight: 1.3 },
  numeric: { fontSize: 14, weight: 500, lineHeight: 1.5, fontFamily: "'IBM Plex Mono', monospace" },
  kpi: { fontSize: 28, weight: 700, lineHeight: 1.1 },
} as const;

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
} as const;

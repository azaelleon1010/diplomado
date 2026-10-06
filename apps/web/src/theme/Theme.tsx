import React, { createContext, useContext } from 'react';
import { colors, semanticColors, spacing, iconSizes, radii, sidebar, breakpoints, layout, zIndex, typography, elevation, motion, transitions } from './tokens';

export interface Theme {
  colors: typeof colors;
  semanticColors: typeof semanticColors;
  spacing: typeof spacing;
  iconSizes: typeof iconSizes;
  radii: typeof radii;
  sidebar: typeof sidebar;
  breakpoints: typeof breakpoints;
  layout: typeof layout;
  zIndex: typeof zIndex;
  typography: typeof typography;
  elevation: typeof elevation;
  motion: typeof motion;
  transitions: typeof transitions;
}

export const theme: Theme = { colors, semanticColors, spacing, iconSizes, radii, sidebar, breakpoints, layout, zIndex, typography, elevation, motion, transitions };

export const ThemeContext = createContext<Theme>(theme);

export interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

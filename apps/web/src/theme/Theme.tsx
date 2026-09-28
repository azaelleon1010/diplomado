import React, { createContext, useContext } from 'react';
import { colors, spacing, radii, sidebar, breakpoints, zIndex, typography, transitions } from './tokens';

export interface Theme {
  colors: typeof colors;
  spacing: typeof spacing;
  radii: typeof radii;
  sidebar: typeof sidebar;
  breakpoints: typeof breakpoints;
  zIndex: typeof zIndex;
  typography: typeof typography;
  transitions: typeof transitions;
}

export const theme: Theme = { colors, spacing, radii, sidebar, breakpoints, zIndex, typography, transitions };

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

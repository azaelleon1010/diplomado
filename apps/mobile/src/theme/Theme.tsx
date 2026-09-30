import React, { createContext, useContext, useMemo, useState } from 'react';
import type { Palette, ThemeScheme } from './tokens';
import { getPalette } from './tokens';

interface ThemeContextValue {
  scheme: ThemeScheme;
  palette: Palette;
}

const ThemeContext = createContext<ThemeContextValue>({
  scheme: 'dark',
  palette: getPalette('dark'),
});

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Dark mode is the primary experience. `scheme` is fixed to 'dark' for now;
 * the context shape already supports switching when light mode is enabled.
 */
export function ThemeProvider({ children }: ThemeProviderProps): React.JSX.Element {
  const [scheme] = useState<ThemeScheme>('dark');
  const value = useMemo<ThemeContextValue>(
    () => ({ scheme, palette: getPalette(scheme) }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

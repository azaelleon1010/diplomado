import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../../apps/web/src/components/Button';
import { Card } from '../../apps/web/src/components/Card';
import { Input } from '../../apps/web/src/components/Input';
import { EmptyState, ErrorState, LoadingState } from '../../apps/web/src/components/States';
import { StatusBadge } from '../../apps/web/src/components/StatusBadge';
import { LoginScreen } from '../../apps/web/src/screens/Login';
import { RegisterScreen } from '../../apps/web/src/screens/Register';
import { ThemeProvider } from '../../apps/web/src/theme/Theme';
import {
  breakpoints,
  colors,
  iconSizes,
  motion,
  radii,
  semanticColors,
  spacing,
  typography,
} from '../../apps/web/src/theme/tokens';
import {
  breakpoints as mobileBreakpoints,
  darkPalette,
  iconSizes as mobileIconSizes,
  motion as mobileMotion,
  radii as mobileRadii,
  semanticColors as mobileSemanticColors,
  spacing as mobileSpacing,
  typography as mobileTypography,
} from '../../apps/mobile/src/theme/tokens';

function render(node: ReactNode): string {
  return renderToStaticMarkup(createElement(ThemeProvider, null, node));
}

describe('shared Web and Mobile design contract', () => {
  it('keeps semantic dark colors, spacing, radius, motion, and breakpoints aligned', () => {
    expect(semanticColors).toEqual(mobileSemanticColors);
    expect(darkPalette.info).toBe(colors.status.info);
    expect(spacing).toEqual(mobileSpacing);
    expect(iconSizes).toEqual(mobileIconSizes);
    expect(radii).toEqual(mobileRadii);
    expect(motion).toEqual(mobileMotion);
    expect(breakpoints).toEqual(mobileBreakpoints);
  });

  it('keeps the shared typography hierarchy at matching sizes and line heights', () => {
    const scales = ['display', 'h1', 'h2', 'h3', 'title', 'body', 'bodySmall', 'caption', 'label', 'numeric', 'data', 'kpi'] as const;
    for (const scale of scales) {
      const webScale = typography[scale];
      const mobileScale = mobileTypography[scale];
      expect(mobileScale.fontSize, scale).toBe(webScale.fontSize);
      expect(mobileScale.fontWeight, scale).toBe(String(webScale.weight));
      expect(mobileScale.lineHeight, scale).toBe(Math.round(webScale.fontSize * webScale.lineHeight));
    }
  });
});

describe('Web design-system primitives', () => {
  it('keeps existing Login and Register screens renderable with the shared controls', () => {
    const onNavigate = () => undefined;
    const login = render(createElement(LoginScreen, { onNavigate }));
    const register = render(createElement(RegisterScreen, { onNavigate }));

    expect(login).toContain('TramaTech ERP');
    expect(login).toContain('aria-label="Empresa"');
    expect(login).toContain('Iniciar sesión');
    expect(register).toContain('Crear cuenta');
    expect(register).toContain('aria-label="Nombre de empresa *"');
  });

  it('renders an accessible busy button', () => {
    const html = render(createElement(Button, { label: 'Guardar', onPress: () => undefined, loading: true }));
    expect(html).toContain('aria-label="Guardar"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('Guardar');
  });

  it('renders an input label, hint, and error state', () => {
    const html = render(createElement(Input, {
      label: 'Correo',
      value: '',
      onChangeText: () => undefined,
      placeholder: 'usuario@empresa.mx',
      error: 'Ingresa un correo válido',
    }));
    expect(html).toContain('aria-label="Correo"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Ingresa un correo válido');
  });

  it('renders semantic status and loading, empty, and error feedback', () => {
    const html = render(createElement('div', null,
      createElement(StatusBadge, { label: 'Activo', type: 'success' }),
      createElement(LoadingState, { label: 'Cargando datos' }),
      createElement(EmptyState, { title: 'Sin resultados', detail: 'Ajusta los filtros.' }),
      createElement(ErrorState, { title: 'No disponible', detail: 'Intenta de nuevo.' }),
      createElement(Card, { variant: 'elevated', children: createElement('span', null, 'Contenido') }),
    ));
    expect(html).toContain('aria-label="Activo"');
    expect(html).toContain('Cargando datos');
    expect(html).toContain('Sin resultados');
    expect(html).toContain('No disponible');
    expect(html).toContain('Contenido');
  });
});

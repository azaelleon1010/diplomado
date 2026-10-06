import { describe, expect, it } from 'vitest';
import {
  canAccessRoute,
  getAuthRedirectTarget,
  getBreadcrumbLabels,
  getCommandRoutes,
  getVisibleNavigationGroups,
  isRouteActive,
} from './registry';

describe('web navigation access', () => {
  it('keeps public routing transitions deterministic', () => {
    expect(getAuthRedirectTarget('/operations/inventory', false)).toBe('/login');
    expect(getAuthRedirectTarget('/login', true)).toBe('/dashboard');
    expect(getAuthRedirectTarget('/register', false)).toBeNull();
  });

  it('shows modules only for permissions present in the backend catalog', () => {
    expect(canAccessRoute('/operations/inventory', [])).toBe(false);
    expect(canAccessRoute('/operations/inventory', ['inventory.read'])).toBe(true);
    expect(canAccessRoute('/people/employees', ['hr.read.self'])).toBe(false);
    expect(canAccessRoute('/people/vacations', ['hr.read.self'])).toBe(true);
    expect(canAccessRoute('/people/employees', ['inventory.read'])).toBe(false);
    expect(canAccessRoute('/sales/customers', ['*'])).toBe(false);
  });

  it('filters the sidebar and command palette through the same route registry', () => {
    const groups = getVisibleNavigationGroups(['purchasing.read']);
    const visiblePaths = groups.flatMap((group) => group.items.map((route) => route.path));
    expect(visiblePaths).toContain('/procurement/purchases');
    expect(visiblePaths).not.toContain('/sales/customers');
    expect(getCommandRoutes(['purchasing.read']).map((route) => route.path)).toContain('/procurement/purchases');
    expect(getCommandRoutes(['purchasing.read']).map((route) => route.path)).not.toContain('/sales/customers');
  });

  it('matches nested active routes and provides route breadcrumbs', () => {
    expect(isRouteActive('/finance/accounting/entries', '/finance/accounting')).toBe(true);
    expect(isRouteActive('/finance/payables', '/finance/accounting')).toBe(false);
    expect(getBreadcrumbLabels('/operations/inventory')).toEqual(['Inicio', 'Operaciones', 'Inventario']);
  });
});

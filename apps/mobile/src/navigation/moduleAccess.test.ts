import { describe, expect, it } from 'vitest';
import { getVisibleModules, getVisibleModulesForSection, hasAnyPermission, MODULE_ACCESS } from './moduleAccess';

describe('mobile module visibility', () => {
  it('uses backend permission names and supports the HR self/team alternatives', () => {
    expect(getVisibleModules(['inventory.read']).map((module) => module.route)).toEqual(['Inventory']);
    expect(getVisibleModules(['hr.read.self'])).toEqual([]);
    expect(getVisibleModules(['hr.read.team']).map((module) => module.route)).toEqual(['HR']);
    expect(hasAnyPermission(['hr.read.self'], MODULE_ACCESS.hrTimeOffRead)).toBe(true);
    expect(getVisibleModules([])).toEqual([]);
  });

  it('groups only visible modules and accepts the backend wildcard grant', () => {
    expect(getVisibleModulesForSection(['production.read', 'finance.read'], 'Operaciones').map((module) => module.route))
      .toEqual(['Production']);
    expect(getVisibleModules(['*'])).toHaveLength(6);
    expect(hasAnyPermission(['inventory.read'], ['inventory.read', 'inventory.update'])).toBe(true);
  });
});

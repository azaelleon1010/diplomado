import { describe, it, expect } from 'vitest';
import { ALL_PERMISSIONS, PERMISSIONS, hasPermission, resolvePermissions } from '../../apps/api/src/modules/identity/domain/permissions';
import { sanitizeForAudit } from '../../apps/api/src/modules/identity/domain/entities';

describe('permissions', () => {
  it('grants listed permissions only', () => {
    expect(hasPermission([PERMISSIONS.INVENTORY_READ], PERMISSIONS.INVENTORY_READ)).toBe(true);
    expect(hasPermission([PERMISSIONS.INVENTORY_READ], PERMISSIONS.INVENTORY_WRITE)).toBe(false);
    expect(hasPermission([], PERMISSIONS.INVENTORY_READ)).toBe(false);
  });

  it('wildcard grants everything', () => {
    expect(hasPermission(['*'], PERMISSIONS.SYSTEM_USERS_WRITE)).toBe(true);
    expect(hasPermission(['*'], 'anything.else')).toBe(true);
  });

  it('resolves union across roles deduplicated', () => {
    const perms = resolvePermissions([
      { permissions: [PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_WRITE] },
      { permissions: [PERMISSIONS.INVENTORY_READ, PERMISSIONS.PRODUCTION_READ] },
    ]);
    expect(perms).toEqual([PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_WRITE, PERMISSIONS.PRODUCTION_READ].sort());
  });

  it('catalog contains the required phase permissions', () => {
    for (const p of [
      'inventory.read', 'inventory.write', 'inventory.withdraw', 'inventory.transfer', 'inventory.adjust',
      'maintenance.create', 'maintenance.assign',
      'production.read', 'production.write',
      'purchasing.read', 'purchasing.write',
      'hr.read.self', 'hr.read.team', 'hr.write',
      'system.users.read', 'system.users.write',
    ]) {
      expect(ALL_PERMISSIONS).toContain(p);
    }
  });
});

describe('sanitizeForAudit', () => {
  it('strips secrets but keeps business fields', () => {
    const out = sanitizeForAudit({
      email: 'a@b.mx',
      password: 'secret',
      passwordHash: 'hash',
      token: 't',
      nested: { refreshToken: 'r', email: 'a@b.mx' },
    });
    expect(out).toMatchObject({ email: 'a@b.mx', nested: { email: 'a@b.mx' } });
    expect(out).not.toHaveProperty('password');
    expect(out).not.toHaveProperty('passwordHash');
    expect(out).not.toHaveProperty('token');
    expect((out?.nested as Record<string, unknown>)).not.toHaveProperty('refreshToken');
  });

  it('returns undefined for non-objects', () => {
    expect(sanitizeForAudit(null)).toBeUndefined();
    expect(sanitizeForAudit('x')).toBeUndefined();
  });
});

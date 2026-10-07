import { describe, it, expect } from 'vitest';
import { openApiSpec } from '../../apps/api/src/openapi';
import type { InventoryRequestOptions } from '../../packages/types/src/inventory';
import { createAdminApi, describeAdminError, groupPermissions, readOnlyPermissions } from '../../packages/types/src/admin';
import { ALL_PERMISSIONS } from '../../packages/types/src/permissions';

/** "/api/v1/roles/abc" → "/roles/{id}". */
function toSpecPath(path: string): string {
  return path
    .replace(/^\/api\/v1/, '')
    .split('?')[0]!
    .split('/')
    .map((segment, i, all) => (i > 0 && segment === 'ID' ? '{id}' : segment) || all[i]!)
    .join('/');
}

describe('shared admin client contract', () => {
  it('only calls operations documented by the API (method + path)', async () => {
    const calls: Array<{ method: string; path: string }> = [];
    const record = async (path: string, options: InventoryRequestOptions) => {
      calls.push({ method: options.method ?? 'GET', path });
      return {} as never;
    };
    const api = createAdminApi({ request: record, page: async (path, options) => ({ data: (await record(path, options)) ?? [] }) });
    const t = 'tok';
    await api.listRoles(t);
    await api.getRole(t, 'ID');
    await api.createRole(t, { name: 'Solo lectura', permissions: ['inventory.read'] });
    await api.updateRole(t, 'ID', { expectedVersion: 1 });
    await api.listUsers(t);
    await api.createUser(t, { email: 'a@x.mx', username: 'a', password: 'Password123' });
    await api.assignRoles(t, 'ID', ['r1']);
    await api.setUserStatus(t, 'ID', 'DISABLED');

    const paths = openApiSpec.paths as Record<string, Record<string, unknown>>;
    const undocumented = calls.filter((c) => !paths[toSpecPath(c.path)]?.[c.method.toLowerCase()]).map((c) => `${c.method} ${c.path}`);
    expect(undocumented).toEqual([]);
    expect(calls).toHaveLength(8);
  });

  it('groups the whole permission catalog with no leftovers', () => {
    const groups = groupPermissions();
    const flattened = groups.flatMap((g) => g.permissions.map((p) => p.value));
    expect(new Set(flattened)).toEqual(new Set(ALL_PERMISSIONS));
  });

  it('identifies read-only permissions across every module', () => {
    const readOnly = readOnlyPermissions();
    expect(readOnly).toEqual(expect.arrayContaining(['inventory.read', 'finance.read', 'hr.read.self', 'hr.read.team']));
    expect(readOnly.some((p) => p.includes('create') || p.includes('update') || p.includes('delete'))).toBe(false);
  });

  it('shows Spanish error messages for business errors', () => {
    expect(describeAdminError({ code: 'VALIDATION_ERROR', fields: { permissions: ['bogus.perm'] } })).toContain('bogus.perm');
    expect(describeAdminError({ code: 'CONFLICT', message: 'Duplicate value for name' })).toContain('Ya existe un rol');
    expect(describeAdminError({ code: 'FORBIDDEN', message: 'The "owner" role cannot be disabled' })).toContain('owner');
    expect(describeAdminError({ code: 'FORBIDDEN', message: 'You cannot deactivate your own account' })).toContain('propia cuenta');
    expect(describeAdminError({ code: 'OTHER' })).toBeNull();
  });
});

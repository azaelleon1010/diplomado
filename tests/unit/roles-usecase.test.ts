import { describe, it, expect } from 'vitest';
import { createRole, getRole, listRoles, updateRole, type RoleDeps } from '../../apps/api/src/modules/identity/application/roles';
import type { ActorContext } from '../../apps/api/src/modules/identity/application/usecases';
import type { IAuditSink, IRoleStore, UpdateRoleData } from '../../apps/api/src/modules/identity/domain/ports';
import type { Role } from '../../apps/api/src/modules/identity/domain/entities';
import { PERMISSIONS } from '../../apps/api/src/modules/identity/domain/permissions';

function makeStores() {
  let seq = 0;
  const id = () => `rol-${++seq}`;
  const roles = new Map<string, Role>();
  const audits: Array<{ action: string; entityId?: string }> = [];

  const roleStore: IRoleStore = {
    findById: async (tenantId, rid) => {
      const r = roles.get(rid);
      return r && r.tenantId === tenantId ? r : null;
    },
    findByIds: async (tenantId, ids) => ids.map((rid) => roles.get(rid)).filter((r): r is Role => !!r && r.tenantId === tenantId),
    findByName: async (tenantId, name) => [...roles.values()].find((r) => r.tenantId === tenantId && r.name === name) ?? null,
    create: async (data) => {
      const r: Role = { _id: id(), tenantId: data.tenantId, name: data.name, description: data.description, permissions: data.permissions, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), version: 1 };
      roles.set(r._id, r);
      return r;
    },
    list: async (tenantId) => [...roles.values()].filter((r) => r.tenantId === tenantId),
    setPermissions: async () => null,
    update: async (tenantId, rid, patch: UpdateRoleData, expectedVersion) => {
      const r = roles.get(rid);
      if (!r || r.tenantId !== tenantId || r.version !== expectedVersion) return null;
      const next: Role = { ...r, ...patch, version: r.version + 1 };
      roles.set(rid, next);
      return next;
    },
  };

  const auditSink: IAuditSink = { record: async (event) => { audits.push({ action: event.action, entityId: event.entityId }); } };

  return { deps: { roles: roleStore, audit: auditSink } satisfies RoleDeps, roles, audits };
}

const ctx: ActorContext = { tenantId: 'tnt_1', userId: 'u1' };

describe('createRole', () => {
  it('creates a role with a known permission set and records an audit event', async () => {
    const { deps, audits } = makeStores();
    const role = await createRole(ctx, { name: 'Solo lectura', permissions: [PERMISSIONS.INVENTORY_READ, PERMISSIONS.FINANCE_READ] }, deps);

    expect(role.name).toBe('Solo lectura');
    expect(role.permissions).toEqual(expect.arrayContaining([PERMISSIONS.INVENTORY_READ, PERMISSIONS.FINANCE_READ]));
    expect(audits.some((a) => a.action === 'roles.created' && a.entityId === role._id)).toBe(true);
  });

  it('de-duplicates repeated permissions', async () => {
    const { deps } = makeStores();
    const role = await createRole(ctx, { name: 'Editor', permissions: [PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_READ] }, deps);
    expect(role.permissions).toEqual([PERMISSIONS.INVENTORY_READ]);
  });

  it('rejects an unknown permission', async () => {
    const { deps } = makeStores();
    await expect(createRole(ctx, { name: 'Raro', permissions: ['not.a.real.permission'] }, deps)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });

  it('rejects a duplicate role name within the tenant', async () => {
    const { deps } = makeStores();
    await createRole(ctx, { name: 'Editor', permissions: [] }, deps);
    await expect(createRole(ctx, { name: 'Editor', permissions: [] }, deps)).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });
});

describe('updateRole', () => {
  it('updates permissions and bumps the version', async () => {
    const { deps } = makeStores();
    const created = await createRole(ctx, { name: 'Editor', permissions: [PERMISSIONS.INVENTORY_READ] }, deps);
    const updated = await updateRole(ctx, created._id, { permissions: [PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_CREATE], expectedVersion: created.version }, deps);
    expect(updated.permissions).toEqual(expect.arrayContaining([PERMISSIONS.INVENTORY_READ, PERMISSIONS.INVENTORY_CREATE]));
    expect(updated.version).toBe(created.version + 1);
  });

  it('rejects a stale version', async () => {
    const { deps } = makeStores();
    const created = await createRole(ctx, { name: 'Editor', permissions: [] }, deps);
    await expect(updateRole(ctx, created._id, { name: 'Editor 2', expectedVersion: created.version + 5 }, deps)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('refuses to disable the owner role', async () => {
    const { deps } = makeStores();
    const owner = await createRole(ctx, { name: 'owner', permissions: [] }, deps);
    await expect(updateRole(ctx, owner._id, { status: 'DISABLED', expectedVersion: owner.version }, deps)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows disabling a non-owner role', async () => {
    const { deps } = makeStores();
    const role = await createRole(ctx, { name: 'Temporal', permissions: [] }, deps);
    const updated = await updateRole(ctx, role._id, { status: 'DISABLED', expectedVersion: role.version }, deps);
    expect(updated.status).toBe('DISABLED');
  });

  it('rejects renaming to a name already used by another role', async () => {
    const { deps } = makeStores();
    await createRole(ctx, { name: 'Editor', permissions: [] }, deps);
    const other = await createRole(ctx, { name: 'Visor', permissions: [] }, deps);
    await expect(updateRole(ctx, other._id, { name: 'Editor', expectedVersion: other.version }, deps)).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects an unknown permission on update', async () => {
    const { deps } = makeStores();
    const role = await createRole(ctx, { name: 'Editor', permissions: [] }, deps);
    await expect(updateRole(ctx, role._id, { permissions: ['bogus'], expectedVersion: role.version }, deps)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('throws NOT_FOUND for a role in another tenant', async () => {
    const { deps } = makeStores();
    const role = await createRole(ctx, { name: 'Editor', permissions: [] }, deps);
    await expect(updateRole({ tenantId: 'tnt_other', userId: 'u2' }, role._id, { expectedVersion: role.version }, deps)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('listRoles / getRole', () => {
  it('lists only roles in the actor tenant', async () => {
    const { deps } = makeStores();
    await createRole(ctx, { name: 'A', permissions: [] }, deps);
    await createRole({ tenantId: 'tnt_2', userId: 'u2' }, { name: 'B', permissions: [] }, deps);
    const list = await listRoles(ctx, deps);
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('A');
  });

  it('throws NOT_FOUND for an unknown id', async () => {
    const { deps } = makeStores();
    await expect(getRole(ctx, 'missing', deps)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

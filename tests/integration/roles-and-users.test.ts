import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, registerCompany, client, type Harness, type Company } from '../helpers/integration';

describe('Roles and user administration: granular permission sets, never admin/viewer flags', () => {
  let h: Harness;
  let company: Company;

  beforeAll(async () => {
    h = await startHarness('test_roles_users');
    company = await registerCompany(h, 'RolesCo');
  });

  afterAll(async () => {
    await h.stop();
  });

  it('creates a read-only role and an editor role with distinct permission sets', async () => {
    const api = client(h, company.token);

    const readOnly = await api.post('/roles', { name: 'Solo lectura', permissions: ['inventory.read', 'finance.read'] });
    expect(readOnly.status).toBe(201);
    expect(readOnly.body.data.permissions).toEqual(expect.arrayContaining(['inventory.read', 'finance.read']));

    const editor = await api.post('/roles', { name: 'Editor de inventario', permissions: ['inventory.read', 'inventory.create', 'inventory.update'] });
    expect(editor.status).toBe(201);
    expect(editor.body.data.permissions).toEqual(expect.arrayContaining(['inventory.read', 'inventory.create', 'inventory.update']));

    const list = await api.get('/roles');
    expect(list.status).toBe(200);
    const names = list.body.data.map((r: { name: string }) => r.name);
    expect(names).toEqual(expect.arrayContaining(['owner', 'Solo lectura', 'Editor de inventario']));
  });

  it('rejects creating a role with an unknown permission', async () => {
    const res = await client(h, company.token).post('/roles', { name: 'Raro', permissions: ['not.a.real.permission'] });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate role name', async () => {
    const api = client(h, company.token);
    await api.post('/roles', { name: 'Duplicado', permissions: [] });
    const res = await api.post('/roles', { name: 'Duplicado', permissions: [] });
    expect(res.status).toBe(409);
  });

  it('updates a role\'s permission set (view-only -> can also edit)', async () => {
    const api = client(h, company.token);
    const created = await api.post('/roles', { name: 'Para ascender', permissions: ['inventory.read'] });
    const updated = await api.patch(`/roles/${created.body.data._id}`, { permissions: ['inventory.read', 'inventory.update'], expectedVersion: created.body.data.version });
    expect(updated.status).toBe(200);
    expect(updated.body.data.permissions).toEqual(expect.arrayContaining(['inventory.read', 'inventory.update']));
  });

  it('refuses to disable the owner role', async () => {
    const api = client(h, company.token);
    const roles = await api.get('/roles');
    const owner = roles.body.data.find((r: { name: string }) => r.name === 'owner');
    const res = await api.patch(`/roles/${owner._id}`, { status: 'DISABLED', expectedVersion: owner.version });
    expect(res.status).toBe(403);
  });

  it('creates a user, assigns the read-only role, and the user list shows it', async () => {
    const api = client(h, company.token);
    const role = await api.post('/roles', { name: `Solo lectura ${h.stamp}`, permissions: ['inventory.read'] });
    const email = `viewer.${h.stamp}@x.mx`;
    const created = await api.post('/users', { email, username: `viewer.${h.stamp}`, password: 'Password123', roleIds: [role.body.data._id] });
    expect(created.status).toBe(201);

    const list = await api.get('/users');
    expect(list.status).toBe(200);
    const row = list.body.data.find((u: { email: string }) => u.email === email);
    expect(row).toBeTruthy();
    expect(row.roles.map((r: { name: string }) => r.name)).toContain(`Solo lectura ${h.stamp}`);
    expect(row.membershipStatus).toBe('ACTIVE');
  });

  it('deactivates and reactivates a user account', async () => {
    const api = client(h, company.token);
    const email = `todeactivate.${h.stamp}@x.mx`;
    const created = await api.post('/users', { email, username: `todeactivate.${h.stamp}`, password: 'Password123' });
    const userId = created.body.data.user._id;

    const deactivated = await api.patch(`/users/${userId}/status`, { status: 'DISABLED' });
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.status).toBe('DISABLED');

    const loginBlocked = await client(h, '').post('/auth/login', { email, password: 'Password123', tenantId: company.tenantId });
    expect(loginBlocked.status).toBe(401);

    const reactivated = await api.patch(`/users/${userId}/status`, { status: 'ACTIVE' });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data.status).toBe('ACTIVE');
  });

  it('refuses to let a user deactivate their own account', async () => {
    const api = client(h, company.token);
    const me = await api.get('/me');
    const res = await api.patch(`/users/${me.body.data.user._id}/status`, { status: 'DISABLED' });
    expect(res.status).toBe(403);
  });

  it('enforces system.users.read/write on role and user-status endpoints', async () => {
    const api = client(h, company.token);
    const role = await api.post('/roles', { name: `Sin permisos de admin ${h.stamp}`, permissions: ['inventory.read'] });
    const email = `restricted.${h.stamp}@x.mx`;
    await api.post('/users', { email, username: `restricted.${h.stamp}`, password: 'Password123', roleIds: [role.body.data._id] });
    const login = await client(h, '').post('/auth/login', { email, password: 'Password123', tenantId: company.tenantId });
    const restrictedToken = login.body.data.accessToken as string;

    const restricted = client(h, restrictedToken);
    expect((await restricted.get('/roles')).status).toBe(403);
    expect((await restricted.post('/roles', { name: 'x', permissions: [] })).status).toBe(403);
  });

  it('never shows another tenant\'s roles or users', async () => {
    const other = await registerCompany(h, 'OtherRolesCo');
    const otherApi = client(h, other.token);
    const roles = await otherApi.get('/roles');
    expect(roles.body.data.map((r: { name: string }) => r.name)).not.toContain('Solo lectura');
    const users = await otherApi.get('/users');
    expect(users.body.data.some((u: { tenantId: string }) => u.tenantId === company.tenantId)).toBe(false);
  });
});

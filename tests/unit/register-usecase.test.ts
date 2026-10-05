import { describe, it, expect } from 'vitest';
import { register, type RegisterDeps } from '../../apps/api/src/modules/identity/application/usecases';
import type {
  IAuditSink,
  IMembershipStore,
  IRoleStore,
  ISessionStore,
  IUserStore,
  TxRunner,
} from '../../apps/api/src/modules/identity/domain/ports';
import type { ITenantStore } from '../../apps/api/src/modules/tenant/domain/ports';
import type { Membership, RefreshSession, Role, Tenant, UserWithCredentials } from '../../apps/api/src/modules/identity/domain/entities';

function makeStores() {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const tenants = new Map<string, Tenant>();
  const bySlug = new Map<string, Tenant>();
  const users: UserWithCredentials[] = [];
  const roles = new Map<string, Role>();
  const memberships: Membership[] = [];
  const sessions: RefreshSession[] = [];
  const audits: unknown[] = [];

  const tenantStore: ITenantStore = {
    findById: async (tenantId) => tenants.get(tenantId) ?? null,
    findBySlug: async (slug) => bySlug.get(slug.toLowerCase()) ?? null,
    create: async (data) => {
      if ([...tenants.values()].some((t) => t.slug === data.slug.toLowerCase())) {
        throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
      }
      const t: Tenant = {
        _id: id('ten'), tenantId: data.tenantId, name: data.name, slug: data.slug.toLowerCase(),
        status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), version: 1,
      };
      tenants.set(t.tenantId, t);
      bySlug.set(t.slug, t);
      return t;
    },
    setStatus: async () => null,
  };

  const userStore: IUserStore = {
    findById: async (tenantId, uid) => users.find((u) => u.tenantId === tenantId && u._id === uid) ?? null,
    findByEmail: async (tenantId, email) => users.find((u) => u.tenantId === tenantId && u.email === email.toLowerCase()) ?? null,
    findByEmailAnyTenant: async (email) => users.filter((u) => u.email === email.toLowerCase()),
    create: async (data) => {
      const u: UserWithCredentials = {
        _id: id('usr'), tenantId: data.tenantId, username: data.username, email: data.email.toLowerCase(),
        passwordHash: data.passwordHash, firstName: data.firstName, lastName: data.lastName,
        status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), version: 1,
      };
      users.push(u);
      return u;
    },
    setStatus: async () => null,
    list: async () => ({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
  };

  const roleStore: IRoleStore = {
    findById: async (_t, rid) => roles.get(rid) ?? null,
    findByIds: async (_t, ids) => ids.map((rid) => roles.get(rid)).filter((r): r is Role => !!r),
    findByName: async (tenantId, name) => [...roles.values()].find((r) => r.tenantId === tenantId && r.name === name) ?? null,
    create: async (data) => {
      const r: Role = {
        _id: id('rol'), tenantId: data.tenantId, name: data.name, description: data.description,
        permissions: data.permissions, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), version: 1,
      };
      roles.set(r._id, r);
      return r;
    },
    list: async () => [],
  };

  const membershipStore: IMembershipStore = {
    findByUserAndTenant: async (userId, tenantId) => memberships.find((m) => m.userId === userId && m.tenantId === tenantId) ?? null,
    findActiveByUser: async () => [],
    create: async (data) => {
      const m: Membership = {
        _id: id('mem'), tenantId: data.tenantId, organizationId: data.organizationId, branchId: data.branchId,
        userId: data.userId, roleIds: data.roleIds, status: 'ACTIVE',
        createdAt: new Date(), updatedAt: new Date(), version: 1,
      };
      memberships.push(m);
      return m;
    },
    setRoles: async () => null,
  };

  const sessionStore: ISessionStore = {
    create: async (data) => {
      const s: RefreshSession = {
        _id: id('ses'), tenantId: data.tenantId, userId: data.userId, sessionId: data.sessionId,
        tokenHash: data.tokenHash, expiresAt: data.expiresAt, revokedAt: null,
        createdAt: new Date(), updatedAt: new Date(), version: 1,
      };
      sessions.push(s);
      return s;
    },
    findBySessionId: async () => null,
    revoke: async () => undefined,
    revokeAllForUser: async () => undefined,
  };

  const auditSink: IAuditSink = {
    record: async (event) => {
      audits.push(event);
    },
  };

  const tx: TxRunner = async (fn) => fn(undefined);

  const emailProvider = {
    sendWelcomeEmail: async () => {},
  };

  const deps: RegisterDeps = {
    tenants: tenantStore,
    users: userStore,
    roles: roleStore,
    memberships: membershipStore,
    sessions: sessionStore,
    audit: auditSink,
    hasher: {
      hash: async (plain) => `hashed:${plain}`,
      verify: async (plain, hash) => hash === `hashed:${plain}`,
    },
    tokens: {
      issueAccess: (input) => `access.${input.sub}.${input.tenantId}.${input.sessionId}`,
      issueRefresh: (input) => ({
        token: `refresh.${input.sub}.${input.tenantId}.${input.sessionId}`,
        expiresAt: new Date(Date.now() + 1000),
      }),
      verifyAccess: () => {
        throw new Error('not implemented');
      },
      verifyRefresh: () => {
        throw new Error('not implemented');
      },
      hashToken: (token) => `sha:${token}`,
      accessTtlSeconds: () => 900,
    },
    emailProvider,
    tx,
  };

  return { deps, tenants, users, roles, memberships, sessions, audits };
}

describe('register use case (fake stores)', () => {
  it('creates tenant + owner role + user + membership + session with login-shaped result', async () => {
    const { deps, tenants, users, roles, memberships, sessions, audits } = makeStores();
    const result = await register(
      { companyName: 'Acme Textil', username: 'owner.acme', email: 'Owner@Acme.mx', password: 'Password123' },
      deps,
    );

    expect(result.tenantId).toMatch(/^tnt_[0-9a-f]{16}$/);
    expect(result.tenant.slug).toBe('acme-textil');
    expect(result.user.email).toBe('owner@acme.mx');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.permissions).toContain('system.users.write');
    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();

    expect(tenants.size).toBe(1);
    expect(users.length).toBe(1);
    expect(users[0]?.passwordHash).toBe('hashed:Password123');
    expect(roles.size).toBe(1);
    const role = [...roles.values()][0];
    expect(role?.name).toBe('owner');
    expect(memberships.length).toBe(1);
    expect(memberships[0]?.roleIds).toEqual([role?._id]);
    expect(sessions.length).toBe(1);
    expect(sessions[0]?.tokenHash.startsWith('sha:refresh.')).toBe(true);
    expect(audits.length).toBe(1);
  });

  it('resolves slug collisions with a suffix', async () => {
    const { deps } = makeStores();
    const first = await register(
      { companyName: 'Acme Textil', username: 'owner.a', email: 'a@x.mx', password: 'Password123' },
      deps,
    );
    const second = await register(
      { companyName: 'Acme Textil', username: 'owner.b', email: 'b@x.mx', password: 'Password123' },
      deps,
    );
    expect(first.tenant.slug).toBe('acme-textil');
    expect(second.tenant.slug.startsWith('acme-textil-')).toBe(true);
    expect(second.tenantId).not.toBe(first.tenantId);
  });

  it('rejects short passwords without touching stores', async () => {
    const { deps, tenants } = makeStores();
    await expect(
      register({ companyName: 'Acme', username: 'owner.c', email: 'c@x.mx', password: 'short' }, deps),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(tenants.size).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { requestPasswordReset, resetPassword, type PasswordResetDeps } from '../../apps/api/src/modules/identity/application/passwordReset';
import type {
  CreatePasswordResetTokenData,
  IAuditSink,
  IMembershipStore,
  IPasswordResetStore,
  IRoleStore,
  ISessionStore,
  IUserStore,
} from '../../apps/api/src/modules/identity/domain/ports';
import type { ITenantStore } from '../../apps/api/src/modules/tenant/domain/ports';
import type { PasswordResetToken, Tenant, UserWithCredentials } from '../../apps/api/src/modules/identity/domain/entities';

interface SentEmail {
  to: string;
  resetUrl: string;
}

function makeStores() {
  let seq = 0;
  const id = (p: string) => `${p}-${++seq}`;
  const tenants = new Map<string, Tenant>();
  const users: UserWithCredentials[] = [];
  const resetTokens: PasswordResetToken[] = [];
  const revokedUsers: string[] = [];
  const audits: Array<{ action: string; tenantId: string; userId?: string }> = [];
  const sentEmails: SentEmail[] = [];

  const tenantStore: ITenantStore = {
    findById: async (tenantId) => tenants.get(tenantId) ?? null,
    findBySlug: async () => null,
    create: async (data) => {
      const t: Tenant = { _id: id('ten'), tenantId: data.tenantId, name: data.name, slug: data.slug.toLowerCase(), status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), version: 1 };
      tenants.set(t.tenantId, t);
      return t;
    },
    setStatus: async () => null,
  };

  const userStore: IUserStore = {
    findById: async (tenantId, uid) => users.find((u) => u.tenantId === tenantId && u._id === uid) ?? null,
    findStatusById: async (tenantId, uid) => users.find((u) => u.tenantId === tenantId && u._id === uid)?.status ?? null,
    findByEmail: async (tenantId, email) => users.find((u) => u.tenantId === tenantId && u.email === email.toLowerCase()) ?? null,
    findByEmailAnyTenant: async (email) => users.filter((u) => u.email === email.toLowerCase()),
    create: async (data) => {
      const u: UserWithCredentials = { _id: id('usr'), tenantId: data.tenantId, username: data.username, email: data.email.toLowerCase(), passwordHash: data.passwordHash, firstName: data.firstName, lastName: data.lastName, status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), version: 1 };
      users.push(u);
      return u;
    },
    setStatus: async () => null,
    setPasswordHash: async (tenantId, uid, passwordHash) => {
      const u = users.find((x) => x.tenantId === tenantId && x._id === uid);
      if (!u) return null;
      u.passwordHash = passwordHash;
      u.version += 1;
      return u;
    },
    list: async () => ({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
  };

  const resetStore: IPasswordResetStore = {
    create: async (data: CreatePasswordResetTokenData) => {
      const t: PasswordResetToken = { _id: id('rst'), tenantId: data.tenantId, userId: data.userId, resetId: data.resetId, tokenHash: data.tokenHash, expiresAt: data.expiresAt, usedAt: null, createdAt: new Date(), updatedAt: new Date(), version: 1 };
      resetTokens.push(t);
      return t;
    },
    findByResetId: async (resetId) => resetTokens.find((t) => t.resetId === resetId) ?? null,
    markUsed: async (resetId) => {
      const t = resetTokens.find((x) => x.resetId === resetId);
      if (t) t.usedAt = new Date();
    },
  };

  const roleStore: IRoleStore = {
    findById: async () => null,
    findByIds: async () => [],
    findByName: async () => null,
    create: async () => { throw new Error('not used'); },
    list: async () => [],
    setPermissions: async () => null,
  };

  const membershipStore: IMembershipStore = {
    findByUserAndTenant: async () => null,
    findActiveByUser: async () => [],
    create: async () => { throw new Error('not used'); },
    setRoles: async () => null,
  };

  const sessionStore: ISessionStore = {
    create: async () => { throw new Error('not used'); },
    findBySessionId: async () => null,
    revoke: async () => undefined,
    revokeAllForUser: async (_tenantId, userId) => {
      revokedUsers.push(userId);
    },
  };

  const auditSink: IAuditSink = {
    record: async (event) => {
      audits.push({ action: event.action, tenantId: event.tenantId, userId: event.userId });
    },
  };

  const deps: PasswordResetDeps = {
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
      issueAccess: () => 'access-token',
      issueRefresh: () => ({ token: 'refresh-token', expiresAt: new Date() }),
      verifyAccess: () => { throw new Error('not implemented'); },
      verifyRefresh: () => { throw new Error('not implemented'); },
      hashToken: (t) => `sha:${t}`,
      accessTtlSeconds: () => 900,
    },
    emailProvider: {
      sendWelcomeEmail: async () => {},
      sendPasswordResetEmail: async (input) => {
        sentEmails.push({ to: input.to, resetUrl: input.resetUrl });
      },
    },
    resetTokens: resetStore,
  };

  async function seedActiveUser(tenantId: string, email: string): Promise<UserWithCredentials> {
    await deps.tenants.create({ tenantId, name: tenantId, slug: tenantId, createdBy: 'test' });
    return deps.users.create({ tenantId, username: email.split('@')[0] ?? email, email, passwordHash: 'hashed:old', createdBy: 'test' });
  }

  /** Extracts rid/token from the link the fake email provider captured. */
  function parseLink(url: string): { resetId: string; token: string } {
    const parsed = new URL(url);
    return { resetId: parsed.searchParams.get('rid') ?? '', token: parsed.searchParams.get('token') ?? '' };
  }

  return { deps, tenants, users, resetTokens, revokedUsers, audits, sentEmails, seedActiveUser, parseLink };
}

describe('requestPasswordReset use case (fake stores)', () => {
  it('sends a reset email and stores a hashed token for an existing active user', async () => {
    const store = makeStores();
    const user = await store.seedActiveUser('tnt_1', 'ana@acme.mx');

    const result = await requestPasswordReset({ email: 'Ana@Acme.mx' }, store.deps);

    expect(result).toEqual({ requested: true });
    expect(store.sentEmails).toHaveLength(1);
    expect(store.sentEmails[0]?.to).toBe('ana@acme.mx');
    expect(store.resetTokens).toHaveLength(1);
    expect(store.resetTokens[0]?.userId).toBe(user._id);
    // The plaintext token never appears in storage, only its hash.
    const { token } = store.parseLink(store.sentEmails[0]!.resetUrl);
    expect(store.resetTokens[0]?.tokenHash).not.toBe(token);
    expect(store.audits.some((a) => a.action === 'auth.passwordReset.requested')).toBe(true);
  });

  it('never reveals that an email does not exist (same generic result, no email sent)', async () => {
    const store = makeStores();
    const result = await requestPasswordReset({ email: 'nobody@acme.mx' }, store.deps);
    expect(result).toEqual({ requested: true });
    expect(store.sentEmails).toHaveLength(0);
    expect(store.resetTokens).toHaveLength(0);
    expect(store.audits).toHaveLength(0);
  });

  it('does nothing when the email is ambiguous across tenants and no tenantId is given', async () => {
    const store = makeStores();
    await store.seedActiveUser('tnt_1', 'shared@acme.mx');
    await store.seedActiveUser('tnt_2', 'shared@acme.mx');
    const result = await requestPasswordReset({ email: 'shared@acme.mx' }, store.deps);
    expect(result).toEqual({ requested: true });
    expect(store.sentEmails).toHaveLength(0);
  });

  it('resolves the ambiguous case when tenantId is given', async () => {
    const store = makeStores();
    await store.seedActiveUser('tnt_1', 'shared@acme.mx');
    await store.seedActiveUser('tnt_2', 'shared@acme.mx');
    const result = await requestPasswordReset({ email: 'shared@acme.mx', tenantId: 'tnt_2' }, store.deps);
    expect(result).toEqual({ requested: true });
    expect(store.sentEmails).toHaveLength(1);
    expect(store.resetTokens[0]?.tenantId).toBe('tnt_2');
  });
});

describe('resetPassword use case (fake stores)', () => {
  it('sets a new password hash, consumes the token and revokes every session', async () => {
    const store = makeStores();
    const user = await store.seedActiveUser('tnt_1', 'ana@acme.mx');
    await requestPasswordReset({ email: 'ana@acme.mx' }, store.deps);
    const { resetId, token } = store.parseLink(store.sentEmails[0]!.resetUrl);

    const result = await resetPassword({ resetId, token, newPassword: 'NewPassword123' }, store.deps);

    expect(result).toEqual({ success: true });
    const updated = store.users.find((u) => u._id === user._id);
    expect(updated?.passwordHash).toBe('hashed:NewPassword123');
    expect(store.resetTokens[0]?.usedAt).not.toBeNull();
    expect(store.revokedUsers).toContain(user._id);
    expect(store.audits.some((a) => a.action === 'auth.passwordReset.success')).toBe(true);
  });

  it('rejects a reused token with the same generic message', async () => {
    const store = makeStores();
    await store.seedActiveUser('tnt_1', 'ana@acme.mx');
    await requestPasswordReset({ email: 'ana@acme.mx' }, store.deps);
    const { resetId, token } = store.parseLink(store.sentEmails[0]!.resetUrl);

    await resetPassword({ resetId, token, newPassword: 'NewPassword123' }, store.deps);
    await expect(resetPassword({ resetId, token, newPassword: 'AnotherPass1' }, store.deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });
  });

  it('rejects a wrong token for a valid resetId', async () => {
    const store = makeStores();
    await store.seedActiveUser('tnt_1', 'ana@acme.mx');
    await requestPasswordReset({ email: 'ana@acme.mx' }, store.deps);
    const { resetId } = store.parseLink(store.sentEmails[0]!.resetUrl);

    await expect(resetPassword({ resetId, token: 'f'.repeat(64), newPassword: 'NewPassword123' }, store.deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });
  });

  it('rejects an unknown resetId', async () => {
    const store = makeStores();
    await expect(resetPassword({ resetId: 'does-not-exist', token: 'f'.repeat(64), newPassword: 'NewPassword123' }, store.deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });
  });

  it('rejects an expired token', async () => {
    const store = makeStores();
    await store.seedActiveUser('tnt_1', 'ana@acme.mx');
    await requestPasswordReset({ email: 'ana@acme.mx' }, store.deps);
    const { resetId, token } = store.parseLink(store.sentEmails[0]!.resetUrl);
    const record = store.resetTokens[0]!;
    record.expiresAt = new Date(Date.now() - 1000);

    await expect(resetPassword({ resetId, token, newPassword: 'NewPassword123' }, store.deps)).rejects.toMatchObject({ code: 'UNAUTHORIZED', statusCode: 401 });
  });

  it('rejects a short new password without touching the token', async () => {
    const store = makeStores();
    await store.seedActiveUser('tnt_1', 'ana@acme.mx');
    await requestPasswordReset({ email: 'ana@acme.mx' }, store.deps);
    const { resetId, token } = store.parseLink(store.sentEmails[0]!.resetUrl);

    await expect(resetPassword({ resetId, token, newPassword: 'short' }, store.deps)).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(store.resetTokens[0]?.usedAt).toBeNull();
  });
});

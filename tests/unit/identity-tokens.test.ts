import { describe, it, expect, beforeAll } from 'vitest';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { JwtIssuer } from '../../apps/api/src/modules/identity/infrastructure/tokens';

const TEST_SECRET = 'test-secret-32-chars-minimum-abc123!!';

describe('JwtIssuer', () => {
  beforeAll(() => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test_jwt';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = TEST_SECRET;
    __resetConfigForTests();
  });

  it('issues and verifies an access token with required claims', () => {
    const issuer = new JwtIssuer();
    const token = issuer.issueAccess({ userId: 'u1', tenantId: 't1', sessionId: 's1' });
    const claims = issuer.verifyAccess(token);
    expect(claims).toMatchObject({ sub: 'u1', tenantId: 't1', sessionId: 's1', type: 'access' });
  });

  it('issues refresh tokens with expiry date', () => {
    const issuer = new JwtIssuer();
    const issued = issuer.issueRefresh({ userId: 'u1', tenantId: 't1', sessionId: 's1' });
    expect(issued.token.length).toBeGreaterThan(0);
    expect(issued.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const claims = issuer.verifyRefresh(issued.token);
    expect(claims.type).toBe('refresh');
  });

  it('rejects cross-type usage (refresh as access)', () => {
    const issuer = new JwtIssuer();
    const issued = issuer.issueRefresh({ userId: 'u1', tenantId: 't1', sessionId: 's1' });
    expect(() => issuer.verifyAccess(issued.token)).toThrow();
  });

  it('rejects tampered tokens', () => {
    const issuer = new JwtIssuer();
    const token = issuer.issueAccess({ userId: 'u1', tenantId: 't1', sessionId: 's1' });
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => issuer.verifyAccess(tampered)).toThrow();
  });

  it('rejects tokens signed with another secret', () => {
    const issuer = new JwtIssuer();
    const token = issuer.issueAccess({ userId: 'u1', tenantId: 't1', sessionId: 's1' });
    process.env.JWT_SECRET = 'another-secret-32-chars-minimum-xyz!!';
    __resetConfigForTests();
    expect(() => new JwtIssuer().verifyAccess(token)).toThrow();
    process.env.JWT_SECRET = TEST_SECRET;
    __resetConfigForTests();
  });

  it('hashToken is deterministic and never contains the token', () => {
    const issuer = new JwtIssuer();
    const token = issuer.issueAccess({ userId: 'u1', tenantId: 't1', sessionId: 's1' });
    const h1 = issuer.hashToken(token);
    const h2 = issuer.hashToken(token);
    expect(h1).toBe(h2);
    expect(h1).not.toContain(token);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });
});

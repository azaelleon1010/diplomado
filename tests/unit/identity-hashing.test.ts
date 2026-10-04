import { describe, it, expect, beforeAll } from 'vitest';
import { __resetConfigForTests } from '../../packages/config/src/index';
import { BcryptHasher } from '../../apps/api/src/modules/identity/infrastructure/hasher';

describe('BcryptHasher', () => {
  beforeAll(() => {
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test_hash';
    process.env.NODE_ENV = 'test';
    process.env.BCRYPT_ROUNDS = '4';
    __resetConfigForTests();
  });

  it('hashes and verifies the same password', async () => {
    const hasher = new BcryptHasher();
    const hash = await hasher.hash('correct-horse-8');
    expect(hash).not.toBe('correct-horse-8');
    expect(await hasher.verify('correct-horse-8', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hasher = new BcryptHasher();
    const hash = await hasher.hash('correct-horse-8');
    expect(await hasher.verify('wrong-password', hash)).toBe(false);
  });

  it('produces different salts per hash', async () => {
    const hasher = new BcryptHasher();
    const a = await hasher.hash('same-password-1');
    const b = await hasher.hash('same-password-1');
    expect(a).not.toBe(b);
  });

  it('rejects empty inputs without throwing', async () => {
    const hasher = new BcryptHasher();
    expect(await hasher.verify('', '')).toBe(false);
    expect(await hasher.verify('x', '')).toBe(false);
  });
});

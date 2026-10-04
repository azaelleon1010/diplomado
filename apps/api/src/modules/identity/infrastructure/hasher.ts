/**
 * BcryptHasher — IPasswordHasher backed by bcryptjs (pure JS, no native build).
 * Rounds come from existing BCRYPT_ROUNDS configuration.
 */
import bcrypt from 'bcryptjs';
import { getConfig } from '@erp/config';
import type { IPasswordHasher } from '../domain/ports';

export class BcryptHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    const rounds = getConfig().BCRYPT_ROUNDS;
    const salt = await bcrypt.genSalt(rounds);
    return bcrypt.hash(plain, salt);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    if (!plain || !hash) return false;
    return bcrypt.compare(plain, hash);
  }
}

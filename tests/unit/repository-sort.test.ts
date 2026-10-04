import { describe, it, expect } from 'vitest';
import { BaseRepository } from '../../packages/database/src/repository';

interface FakeDoc {
  _id: unknown;
  tenantId: string;
  version: number;
}

class FakeRepo extends BaseRepository<FakeDoc> {
  constructor() {
    super({} as never);
  }
}

describe('BaseRepository sort allowlist (no DB required)', () => {
  it('rejects non-allowlisted sort fields fail-closed', async () => {
    const repo = new FakeRepo();
    await expect(
      repo.findMany({}, { tenantId: 't1', userId: 'u1' }, { page: 1, limit: 10, sortBy: '$where', sortOrder: 'asc' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });

  it('rejects sortBy not in caller-provided allowlist', async () => {
    const repo = new FakeRepo();
    await expect(
      repo.findMany({}, { tenantId: 't1', userId: 'u1' }, { page: 1, limit: 10, sortBy: 'createdAt', sortOrder: 'desc' }, undefined, { allowedSortFields: ['email'] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

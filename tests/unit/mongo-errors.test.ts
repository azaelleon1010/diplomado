import { describe, it, expect } from 'vitest';
import { AppError } from '../../packages/errors/src/index';
import { isTransientTransactionError, mapMongoError } from '../../packages/database/src/errors';

describe('mapMongoError', () => {
  it('lets transient transaction errors through so withTransaction can retry', () => {
    const conflict = Object.assign(new Error('Write conflict'), {
      code: 112,
      hasErrorLabel: (label: string) => label === 'TransientTransactionError',
    });
    expect(isTransientTransactionError(conflict)).toBe(true);
    expect(mapMongoError(conflict)).toBe(conflict);
    expect(isTransientTransactionError({ errorLabels: ['TransientTransactionError'] })).toBe(true);
  });

  it('still maps duplicate keys to a 409 AppError', () => {
    const mapped = mapMongoError(Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyValue: { sku: 'A' } }));
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped).toMatchObject({ code: 'CONFLICT', statusCode: 409 });
  });
});

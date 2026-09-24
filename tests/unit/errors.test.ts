import { describe, it, expect } from 'vitest';
import { AppError, validationError, notFound, versionConflict } from '../../packages/errors/src/index';

describe('errors', () => {
  it('creates structured AppError', () => {
    const err = validationError('bad input', { field: 'name' });
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.isOperational).toBe(true);
  });

  it('notFound helper', () => {
    const err = notFound('missing');
    expect(err.statusCode).toBe(404);
  });

  it('version conflict carries currentVersion', () => {
    const err = versionConflict(7);
    expect(err.code).toBe('VERSION_CONFLICT');
    expect(err.fields?.currentVersion).toBe(7);
  });

  it('AppError instanceof Error', () => {
    const err = new AppError({ code: 'INTERNAL_ERROR', message: 'oops', statusCode: 500 });
    expect(err instanceof Error).toBe(true);
  });
});

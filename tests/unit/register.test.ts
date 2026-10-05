import { describe, it, expect } from 'vitest';
import { slugifyCompanyName } from '../../apps/api/src/modules/identity/application/usecases';

describe('slugifyCompanyName', () => {
  it('normalizes names to URL-safe slugs', () => {
    expect(slugifyCompanyName('Mi Empresa S.A. de C.V.')).toBe('mi-empresa-s-a-de-c-v');
    expect(slugifyCompanyName('  Textiles   del Norte  ')).toBe('textiles-del-norte');
  });

  it('strips diacritics', () => {
    expect(slugifyCompanyName('Hilandería El Águila')).toBe('hilanderia-el-aguila');
  });

  it('falls back for empty results', () => {
    expect(slugifyCompanyName('---')).toBe('empresa');
    expect(slugifyCompanyName('')).toBe('empresa');
  });

  it('truncates long names', () => {
    expect(slugifyCompanyName('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

import { describe, it, expect } from 'vitest';
import { addDays, agingBucket } from '../../apps/api/src/modules/purchasing/domain/invoices';

describe('accounts payable aging', () => {
  const today = new Date('2026-10-06T15:30:00Z');

  it('classifies by days past due at day boundaries', () => {
    expect(agingBucket('2026-10-06', today)).toBe('current');
    expect(agingBucket('2026-12-31', today)).toBe('current');
    expect(agingBucket('2026-10-05', today)).toBe('d1_30');
    expect(agingBucket('2026-09-06', today)).toBe('d1_30');
    expect(agingBucket('2026-09-05', today)).toBe('d31_60');
    expect(agingBucket('2026-08-07', today)).toBe('d31_60');
    expect(agingBucket('2026-08-06', today)).toBe('d61_90');
    expect(agingBucket('2026-07-08', today)).toBe('d61_90');
    expect(agingBucket('2026-07-07', today)).toBe('d90_plus');
  });

  it('adds payment terms across month and leap-year boundaries', () => {
    expect(addDays('2026-01-31', 30)).toBe('2026-03-02');
    expect(addDays('2028-02-15', 15)).toBe('2028-03-01');
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14');
    expect(addDays('2026-05-10', 0)).toBe('2026-05-10');
  });
});

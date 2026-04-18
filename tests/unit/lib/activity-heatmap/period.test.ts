import { describe, expect, it } from 'vitest';
import {
  buildPeriodOptions,
  enumerateDays,
  normalizePeriodValue,
  parseIsoDate,
  resolvePeriodRange,
  toIsoDate,
} from '@/lib/activity-heatmap/period';

describe('toIsoDate / parseIsoDate', () => {
  it('roundtrips UTC dates through ISO (YYYY-MM-DD) without drift', () => {
    const date = new Date(Date.UTC(2024, 1, 29, 12, 30, 45));
    const iso = toIsoDate(date);
    expect(iso).toBe('2024-02-29');
    expect(toIsoDate(parseIsoDate(iso))).toBe(iso);
  });

  it('zero-pads single-digit months and days', () => {
    expect(toIsoDate(new Date(Date.UTC(2024, 0, 5)))).toBe('2024-01-05');
  });
});

describe('normalizePeriodValue', () => {
  it('returns the rolling period for null/empty/unknown input', () => {
    expect(normalizePeriodValue(null)).toBe('last-12m');
    expect(normalizePeriodValue(undefined)).toBe('last-12m');
    expect(normalizePeriodValue('')).toBe('last-12m');
    expect(normalizePeriodValue('banana')).toBe('last-12m');
    expect(normalizePeriodValue('24')).toBe('last-12m');
  });

  it('accepts four-digit year strings verbatim', () => {
    expect(normalizePeriodValue('2024')).toBe('2024');
    expect(normalizePeriodValue('last-12m')).toBe('last-12m');
  });
});

describe('resolvePeriodRange', () => {
  it('builds a rolling 365-day window ending today (inclusive)', () => {
    const now = new Date(Date.UTC(2026, 3, 18));
    const range = resolvePeriodRange('last-12m', now);
    expect(range.endDate).toBe('2026-04-18');
    expect(range.startDate).toBe('2025-04-19');
    expect(range.value).toBe('last-12m');
  });

  it('clamps the current year to today', () => {
    const now = new Date(Date.UTC(2026, 3, 18));
    const range = resolvePeriodRange('2026', now);
    expect(range.startDate).toBe('2026-01-01');
    expect(range.endDate).toBe('2026-04-18');
  });

  it('spans the full calendar year for a completed year', () => {
    const now = new Date(Date.UTC(2026, 3, 18));
    const range = resolvePeriodRange('2024', now);
    expect(range.startDate).toBe('2024-01-01');
    expect(range.endDate).toBe('2024-12-31');
  });
});

describe('buildPeriodOptions', () => {
  it('returns only the rolling option when the user joined this year', () => {
    const now = new Date(Date.UTC(2026, 3, 18));
    const options = buildPeriodOptions(new Date(Date.UTC(2026, 0, 1)), now);
    expect(options).toEqual([{ value: 'last-12m', label: 'Last 12 months' }]);
  });

  it('lists years from current down to account creation year', () => {
    const now = new Date(Date.UTC(2026, 3, 18));
    const options = buildPeriodOptions(new Date(Date.UTC(2024, 5, 1)), now);
    expect(options).toEqual([
      { value: 'last-12m', label: 'Last 12 months' },
      { value: '2026', label: '2026' },
      { value: '2025', label: '2025' },
      { value: '2024', label: '2024' },
    ]);
  });
});

describe('enumerateDays', () => {
  it('produces every calendar day in the inclusive range', () => {
    const days = enumerateDays('2024-02-28', '2024-03-02');
    expect(days).toEqual(['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02']);
  });

  it('returns a single day when start equals end', () => {
    expect(enumerateDays('2024-06-15', '2024-06-15')).toEqual(['2024-06-15']);
  });
});

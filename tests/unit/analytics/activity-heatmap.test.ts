import { describe, expect, it } from 'vitest';
import {
  buildEmptyCells,
  formatUtcDateKey,
  getAvailableYears,
  resolvePeriodRange,
} from '@/lib/analytics/activity-heatmap';

describe('formatUtcDateKey', () => {
  it('formats UTC midnight as YYYY-MM-DD', () => {
    expect(formatUtcDateKey(new Date(Date.UTC(2025, 0, 5)))).toBe('2025-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(formatUtcDateKey(new Date(Date.UTC(2025, 8, 9)))).toBe('2025-09-09');
  });
});

describe('resolvePeriodRange', () => {
  it('returns Jan 1 to Dec 31 for a year period', () => {
    const { start, end } = resolvePeriodRange({ kind: 'year', year: 2024 }, new Date());
    expect(formatUtcDateKey(start)).toBe('2024-01-01');
    expect(formatUtcDateKey(end)).toBe('2024-12-31');
  });

  it('returns 365 days ending today for rolling period', () => {
    const now = new Date(Date.UTC(2026, 3, 17));
    const { start, end } = resolvePeriodRange({ kind: 'rolling', months: 12 }, now);
    expect(formatUtcDateKey(end)).toBe('2026-04-17');
    expect(formatUtcDateKey(start)).toBe('2025-04-18');
  });
});

describe('getAvailableYears', () => {
  it('returns empty array when user was created this year', () => {
    const now = new Date(Date.UTC(2026, 0, 15));
    const createdAt = new Date(Date.UTC(2026, 0, 1));
    expect(getAvailableYears(createdAt, now)).toEqual([]);
  });

  it('returns descending years from current down to creation year', () => {
    const now = new Date(Date.UTC(2026, 3, 17));
    const createdAt = new Date(Date.UTC(2023, 5, 1));
    expect(getAvailableYears(createdAt, now)).toEqual([2026, 2025, 2024, 2023]);
  });

  it('returns just previous year when created exactly last year', () => {
    const now = new Date(Date.UTC(2026, 3, 17));
    const createdAt = new Date(Date.UTC(2025, 7, 1));
    expect(getAvailableYears(createdAt, now)).toEqual([2026, 2025]);
  });
});

describe('buildEmptyCells', () => {
  it('produces one cell per day inclusive', () => {
    const start = new Date(Date.UTC(2025, 0, 1));
    const end = new Date(Date.UTC(2025, 0, 5));
    const cells = buildEmptyCells(start, end);
    expect(cells.size).toBe(5);
    expect(cells.get('2025-01-01')).toEqual({
      date: '2025-01-01',
      jobCount: 0,
      totalCost: null,
      ticketsShipped: 0,
    });
    expect(cells.get('2025-01-05')).toBeDefined();
  });
});

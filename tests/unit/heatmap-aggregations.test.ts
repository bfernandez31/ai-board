import { describe, expect, it } from 'vitest';
import {
  buildPeriodOptions,
  computeIntensityThresholds,
  enumerateDateKeys,
  formatDateKey,
  formatHeaderCopy,
  getIntensityClass,
  getIntensityLevel,
  getPeriodBounds,
} from '@/lib/heatmap/aggregations';

describe('getPeriodBounds', () => {
  it('returns a 365-day window for last-12-months anchored to now', () => {
    const now = new Date(2026, 3, 16, 10, 0, 0); // 2026-04-16 local
    const userCreatedAt = new Date(2024, 0, 10);

    const bounds = getPeriodBounds('last-12-months', userCreatedAt, now);

    expect(bounds.endDate.getFullYear()).toBe(2026);
    expect(bounds.endDate.getMonth()).toBe(3);
    expect(bounds.endDate.getDate()).toBe(16);

    const diffDays = Math.floor(
      (bounds.endDate.getTime() - bounds.startDate.getTime()) / (24 * 60 * 60 * 1000)
    );
    expect(diffDays).toBe(365);

    expect(bounds.gridStart.getDay()).toBe(0);
    expect(bounds.gridEnd.getDay()).toBe(6);
  });

  it('returns full-year bounds for a specific year including leap year 2024', () => {
    const now = new Date(2026, 3, 16);
    const userCreatedAt = new Date(2023, 0, 1);

    const bounds = getPeriodBounds('2024', userCreatedAt, now);

    expect(bounds.startDate.getFullYear()).toBe(2024);
    expect(bounds.startDate.getMonth()).toBe(0);
    expect(bounds.startDate.getDate()).toBe(1);
    expect(bounds.endDate.getFullYear()).toBe(2024);
    expect(bounds.endDate.getMonth()).toBe(11);
    expect(bounds.endDate.getDate()).toBe(31);

    const keys = enumerateDateKeys(bounds.startDate, bounds.endDate);
    expect(keys).toHaveLength(366);
  });

  it('returns 365 in-period days for a non-leap year', () => {
    const now = new Date(2026, 3, 16);
    const userCreatedAt = new Date(2023, 0, 1);

    const bounds = getPeriodBounds('2025', userCreatedAt, now);
    const keys = enumerateDateKeys(bounds.startDate, bounds.endDate);
    expect(keys).toHaveLength(365);
  });

  it('grid bounds always snap to Sunday..Saturday for year periods', () => {
    const now = new Date(2026, 3, 16);
    const userCreatedAt = new Date(2020, 0, 1);

    const bounds = getPeriodBounds('2024', userCreatedAt, now);
    expect(bounds.gridStart.getDay()).toBe(0);
    expect(bounds.gridEnd.getDay()).toBe(6);
  });
});

describe('buildPeriodOptions', () => {
  it('returns only the rolling default when user was created in the current year', () => {
    const now = new Date(2026, 3, 16);
    const userCreatedAt = new Date(2026, 1, 1);

    const options = buildPeriodOptions(userCreatedAt, now);

    expect(options).toEqual([
      { value: 'last-12-months', label: 'Last 12 months', isDefault: true },
    ]);
  });

  it('returns descending year options after the default for older accounts', () => {
    const now = new Date(2026, 3, 16);
    const userCreatedAt = new Date(2023, 5, 1);

    const options = buildPeriodOptions(userCreatedAt, now);

    expect(options[0]).toMatchObject({ value: 'last-12-months', isDefault: true });
    expect(options.slice(1).map((o) => o.value)).toEqual(['2026', '2025', '2024', '2023']);
    for (const option of options.slice(1)) {
      expect(option.isDefault).toBe(false);
    }
  });
});

describe('computeIntensityThresholds', () => {
  it('returns all-zero thresholds when the input is empty', () => {
    expect(computeIntensityThresholds([])).toEqual([0, 0, 0, 0]);
  });

  it('returns single-day thresholds uniformly when only one day has activity', () => {
    const thresholds = computeIntensityThresholds([5]);
    expect(thresholds[3]).toBe(5);
  });

  it('computes ascending quartiles over a uniform distribution', () => {
    const counts = [1, 2, 3, 4, 5, 6, 7, 8];
    const [q1, q2, q3, max] = computeIntensityThresholds(counts);
    expect(q1).toBeLessThanOrEqual(q2);
    expect(q2).toBeLessThanOrEqual(q3);
    expect(q3).toBeLessThanOrEqual(max);
    expect(max).toBe(8);
  });

  it('returns skewed thresholds when a single outlier dominates', () => {
    const counts = [1, 1, 1, 1, 1, 1, 1, 100];
    const [, , , max] = computeIntensityThresholds(counts);
    expect(max).toBe(100);
  });
});

describe('getIntensityLevel', () => {
  const thresholds = [2, 5, 10, 20] as const;

  it('returns 0 for zero or negative counts', () => {
    expect(getIntensityLevel(0, [...thresholds])).toBe(0);
    expect(getIntensityLevel(-1, [...thresholds])).toBe(0);
  });

  it('inclusively assigns the upper boundary of each bucket', () => {
    expect(getIntensityLevel(2, [...thresholds])).toBe(1);
    expect(getIntensityLevel(5, [...thresholds])).toBe(2);
    expect(getIntensityLevel(10, [...thresholds])).toBe(3);
    expect(getIntensityLevel(20, [...thresholds])).toBe(4);
    expect(getIntensityLevel(1000, [...thresholds])).toBe(4);
  });

  it('handles mid-bucket values correctly', () => {
    expect(getIntensityLevel(1, [...thresholds])).toBe(1);
    expect(getIntensityLevel(4, [...thresholds])).toBe(2);
    expect(getIntensityLevel(7, [...thresholds])).toBe(3);
    expect(getIntensityLevel(15, [...thresholds])).toBe(4);
  });
});

describe('getIntensityClass', () => {
  it('returns complete literal Tailwind strings per level', () => {
    expect(getIntensityClass(0)).toBe('bg-muted/30');
    expect(getIntensityClass(1)).toBe('bg-violet-500/20');
    expect(getIntensityClass(2)).toBe('bg-violet-500/40');
    expect(getIntensityClass(3)).toBe('bg-violet-500/70');
    expect(getIntensityClass(4)).toBe('bg-violet-500');
  });
});

describe('formatHeaderCopy', () => {
  it('formats pluralisation and rolling period suffix', () => {
    expect(
      formatHeaderCopy('last-12-months', { jobCount: 12, shippedTicketCount: 3 })
    ).toBe('12 jobs · 3 tickets shipped in the last year');
  });

  it('uses singular forms for counts of 1', () => {
    expect(formatHeaderCopy('last-12-months', { jobCount: 1, shippedTicketCount: 1 })).toBe(
      '1 job · 1 ticket shipped in the last year'
    );
  });

  it('uses the year label for year periods', () => {
    expect(formatHeaderCopy('2024', { jobCount: 10, shippedTicketCount: 0 })).toBe(
      '10 jobs · 0 tickets shipped in 2024'
    );
  });
});

describe('formatDateKey / enumerateDateKeys', () => {
  it('formats dates in YYYY-MM-DD local time', () => {
    expect(formatDateKey(new Date(2024, 0, 1))).toBe('2024-01-01');
  });

  it('enumerates contiguous calendar dates from gridStart to gridEnd inclusive', () => {
    const gridStart = new Date(2024, 0, 7); // Sunday
    const gridEnd = new Date(2024, 0, 13, 23, 59, 59); // Saturday
    const keys = enumerateDateKeys(gridStart, gridEnd);
    expect(keys).toEqual([
      '2024-01-07',
      '2024-01-08',
      '2024-01-09',
      '2024-01-10',
      '2024-01-11',
      '2024-01-12',
      '2024-01-13',
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  bucketLevel,
  computeIntensityThresholds,
  formatDayKey,
  resolvePeriodRange,
} from '@/lib/analytics/heatmap-queries';

describe('computeIntensityThresholds', () => {
  it('returns inert thresholds when all days have zero jobs', () => {
    expect(computeIntensityThresholds([0, 0, 0])).toEqual({ t1: 1, t2: 2, t3: 3, t4: 4 });
  });

  it('guarantees strictly ascending thresholds when all non-zero values are identical', () => {
    const thresholds = computeIntensityThresholds([0, 5, 5, 5, 5]);
    expect(thresholds.t1).toBeGreaterThanOrEqual(1);
    expect(thresholds.t2).toBeGreaterThan(thresholds.t1);
    expect(thresholds.t3).toBeGreaterThan(thresholds.t2);
    expect(thresholds.t4).toBeGreaterThan(thresholds.t3);
  });

  it('produces quartile-ish thresholds for an uneven distribution', () => {
    const counts = [1, 2, 3, 4, 5, 6, 8, 10, 12, 20];
    const thresholds = computeIntensityThresholds(counts);
    expect(thresholds.t1).toBeGreaterThanOrEqual(1);
    expect(thresholds.t4).toBe(20);
    expect(thresholds.t1).toBeLessThanOrEqual(thresholds.t2);
    expect(thresholds.t2).toBeLessThanOrEqual(thresholds.t3);
    expect(thresholds.t3).toBeLessThanOrEqual(thresholds.t4);
  });
});

describe('bucketLevel', () => {
  const thresholds = { t1: 1, t2: 3, t3: 6, t4: 12 };

  it('returns 0 for zero counts', () => {
    expect(bucketLevel(0, thresholds)).toBe(0);
  });

  it('returns the correct level for each band', () => {
    expect(bucketLevel(1, thresholds)).toBe(1);
    expect(bucketLevel(3, thresholds)).toBe(2);
    expect(bucketLevel(6, thresholds)).toBe(3);
    expect(bucketLevel(7, thresholds)).toBe(4);
    expect(bucketLevel(100, thresholds)).toBe(4);
  });
});

describe('formatDayKey', () => {
  it('buckets 2025-06-15T02:00:00Z into 2025-06-15 in UTC', () => {
    const date = new Date('2025-06-15T02:00:00Z');
    expect(formatDayKey(date, 'UTC')).toBe('2025-06-15');
  });

  it('buckets 2025-06-15T02:00:00Z into 2025-06-14 in America/New_York (EDT)', () => {
    const date = new Date('2025-06-15T02:00:00Z');
    expect(formatDayKey(date, 'America/New_York')).toBe('2025-06-14');
  });

  it('falls back to UTC when the timezone is invalid', () => {
    const date = new Date('2025-06-15T02:00:00Z');
    expect(formatDayKey(date, 'not-a-real-zone')).toBe('2025-06-15');
  });
});

describe('resolvePeriodRange', () => {
  it('produces a 365-day window for last-12-months in UTC', () => {
    const now = new Date('2026-04-19T12:00:00Z');
    const result = resolvePeriodRange({ kind: 'last-12-months' }, 'UTC', now);
    expect(result.rangeEndKey).toBe('2026-04-19');
    expect(result.rangeStartKey).toBe('2025-04-20');
    expect(result.label).toBe('Last 12 months');
  });

  it('produces a Jan 1..Dec 31 window for a past calendar year', () => {
    const now = new Date('2026-04-19T12:00:00Z');
    const result = resolvePeriodRange({ kind: 'calendar-year', year: 2025 }, 'UTC', now);
    expect(result.rangeStartKey).toBe('2025-01-01');
    expect(result.rangeEndKey).toBe('2025-12-31');
    expect(result.label).toBe('2025');
  });

  it('clamps the current calendar year to today', () => {
    const now = new Date('2026-04-19T12:00:00Z');
    const result = resolvePeriodRange({ kind: 'calendar-year', year: 2026 }, 'UTC', now);
    expect(result.rangeStartKey).toBe('2026-01-01');
    expect(result.rangeEndKey).toBe('2026-04-19');
  });
});

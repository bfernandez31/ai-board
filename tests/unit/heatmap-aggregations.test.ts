import { describe, expect, it } from 'vitest';
import {
  assignIntensityBucket,
  computeQuantileBuckets,
  formatUTCDate,
  getHeatmapPeriodBounds,
} from '@/lib/analytics/aggregations';
import type { BucketThresholds } from '@/lib/analytics/heatmap-types';

describe('computeQuantileBuckets', () => {
  it('returns all-zero thresholds for an empty input', () => {
    expect(computeQuantileBuckets([])).toEqual({
      p25: 0,
      p50: 0,
      p75: 0,
      maxJobCount: 0,
    });
  });

  it('collapses to the single value for [1]', () => {
    const t = computeQuantileBuckets([1]);
    expect(t.p25).toBe(1);
    expect(t.p50).toBe(1);
    expect(t.p75).toBe(1);
    expect(t.maxJobCount).toBe(1);
  });

  it('keeps every threshold at the single value when all days share the same count', () => {
    const t = computeQuantileBuckets([1, 1, 1]);
    expect(t.p25).toBe(1);
    expect(t.p50).toBe(1);
    expect(t.p75).toBe(1);
    expect(t.maxJobCount).toBe(1);
  });

  it('distributes thresholds across a varied distribution', () => {
    const t = computeQuantileBuckets([1, 2, 3, 4, 5, 10, 10, 10]);
    expect(t.maxJobCount).toBe(10);
    expect(t.p25).toBeGreaterThanOrEqual(1);
    expect(t.p25).toBeLessThanOrEqual(3);
    expect(t.p50).toBeGreaterThanOrEqual(3);
    expect(t.p50).toBeLessThanOrEqual(5);
    expect(t.p75).toBeGreaterThanOrEqual(5);
    expect(t.p75).toBeLessThanOrEqual(10);
  });

  it('does not let a single outlier pin p25 at the outlier value', () => {
    const t = computeQuantileBuckets([1, 1, 1, 1, 100]);
    expect(t.p25).toBe(1);
    expect(t.p50).toBe(1);
    expect(t.p75).toBe(1);
    expect(t.maxJobCount).toBe(100);
  });
});

describe('assignIntensityBucket', () => {
  const thresholds: BucketThresholds = { p25: 2, p50: 5, p75: 10, maxJobCount: 20 };

  it('returns 0 when jobCount is 0', () => {
    expect(assignIntensityBucket(0, thresholds)).toBe(0);
  });

  it('returns 1 at or below p25', () => {
    expect(assignIntensityBucket(1, thresholds)).toBe(1);
    expect(assignIntensityBucket(2, thresholds)).toBe(1);
  });

  it('returns 2 between p25 (exclusive) and p50 (inclusive)', () => {
    expect(assignIntensityBucket(3, thresholds)).toBe(2);
    expect(assignIntensityBucket(5, thresholds)).toBe(2);
  });

  it('returns 3 between p50 (exclusive) and p75 (inclusive)', () => {
    expect(assignIntensityBucket(6, thresholds)).toBe(3);
    expect(assignIntensityBucket(10, thresholds)).toBe(3);
  });

  it('returns 4 above p75', () => {
    expect(assignIntensityBucket(11, thresholds)).toBe(4);
    expect(assignIntensityBucket(20, thresholds)).toBe(4);
  });

  it('keeps bucket 1 non-empty when every non-zero day shares the same count', () => {
    const flat = computeQuantileBuckets([1, 1, 1, 1]);
    expect(assignIntensityBucket(1, flat)).toBe(1);
  });
});

describe('getHeatmapPeriodBounds', () => {
  it('returns 365 days for rolling12m including DST boundaries', () => {
    const now = new Date('2025-03-15T00:00:00.000Z');
    const { startDate, endDate } = getHeatmapPeriodBounds({ kind: 'rolling12m', endDate: '2025-03-15' }, now);
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    const days = Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
    expect(days).toBe(365);
  });

  it('includes Feb 29 for leap year 2024', () => {
    const now = new Date('2024-07-01T00:00:00.000Z');
    const { startDate, endDate } = getHeatmapPeriodBounds({ kind: 'year', year: 2024 }, now);
    expect(formatUTCDate(startDate)).toBe('2024-01-01');
    expect(formatUTCDate(endDate)).toBe('2024-12-31');

    const dayMs = 24 * 60 * 60 * 1000;
    const days = Math.round((endDate.getTime() - startDate.getTime()) / dayMs);
    expect(days).toBe(366);
  });

  it('returns Jan 1 to Dec 31 of the requested year', () => {
    const now = new Date('2026-04-19T00:00:00.000Z');
    const { startDate, endDate } = getHeatmapPeriodBounds({ kind: 'year', year: 2025 }, now);
    expect(formatUTCDate(startDate)).toBe('2025-01-01');
    expect(formatUTCDate(endDate)).toBe('2025-12-31');
  });
});

describe('formatUTCDate', () => {
  it('formats consistently using UTC components', () => {
    const d = new Date('2025-04-15T10:30:00.000Z');
    expect(formatUTCDate(d)).toBe('2025-04-15');
  });

  it('zero-pads single-digit months and days', () => {
    const d = new Date(Date.UTC(2025, 0, 5));
    expect(formatUTCDate(d)).toBe('2025-01-05');
  });

  it('keeps the UTC day regardless of local tz offset component', () => {
    const d = new Date('2025-04-15T23:59:59.999Z');
    expect(formatUTCDate(d)).toBe('2025-04-15');
  });
});

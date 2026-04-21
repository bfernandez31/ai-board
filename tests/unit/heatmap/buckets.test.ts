import { describe, expect, it } from 'vitest';
import { bucketFor, computeIntensityThresholds } from '@/lib/heatmap/buckets';

describe('computeIntensityThresholds', () => {
  it('returns default thresholds for empty input', () => {
    const t = computeIntensityThresholds([]);
    expect(t).toEqual({ t1: 1, t2: 1, t3: 1, t4: 1 });
  });

  it('handles a single non-zero value (degenerate)', () => {
    const t = computeIntensityThresholds([5]);
    expect(t.t1).toBe(1);
    expect(t.t2).toBeGreaterThanOrEqual(t.t1);
    expect(t.t3).toBeGreaterThanOrEqual(t.t2);
    expect(t.t4).toBeGreaterThanOrEqual(t.t3);
  });

  it('keeps thresholds monotonic when all values equal', () => {
    const t = computeIntensityThresholds([3, 3, 3, 3, 3]);
    expect(t.t1).toBe(1);
    expect(t.t2).toBeGreaterThanOrEqual(t.t1);
    expect(t.t3).toBeGreaterThanOrEqual(t.t2);
    expect(t.t4).toBeGreaterThanOrEqual(t.t3);
  });

  it('produces increasing thresholds on a skewed distribution', () => {
    const counts = [1, 1, 2, 2, 3, 5, 8, 10, 15, 20];
    const t = computeIntensityThresholds(counts);
    expect(t.t1).toBe(1);
    expect(t.t2).toBeGreaterThanOrEqual(1);
    expect(t.t3).toBeGreaterThanOrEqual(t.t2);
    expect(t.t4).toBeGreaterThanOrEqual(t.t3);
  });

  it('rounds percentile thresholds up (never zero)', () => {
    const t = computeIntensityThresholds([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    expect(t.t1).toBe(1);
    expect(t.t2).toBeGreaterThanOrEqual(1);
  });
});

describe('bucketFor', () => {
  const thresholds = { t1: 1, t2: 3, t3: 7, t4: 15 };

  it('returns 0 when count is 0', () => {
    expect(bucketFor(0, thresholds)).toBe(0);
  });

  it('returns 1 at boundary (count === t1)', () => {
    expect(bucketFor(1, thresholds)).toBe(1);
  });

  it('returns 2 at boundary (count === t2)', () => {
    expect(bucketFor(3, thresholds)).toBe(2);
  });

  it('returns 3 at boundary (count === t3)', () => {
    expect(bucketFor(7, thresholds)).toBe(3);
  });

  it('returns 4 at boundary (count === t4)', () => {
    expect(bucketFor(15, thresholds)).toBe(4);
  });

  it('returns 4 well above t4', () => {
    expect(bucketFor(1000, thresholds)).toBe(4);
  });

  it('returns 1 for low non-zero below t2', () => {
    expect(bucketFor(2, thresholds)).toBe(1);
  });
});

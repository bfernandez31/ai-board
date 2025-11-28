import { describe, it, expect } from 'vitest';
import {
  calculateCacheEfficiency,
  calculateSuccessRate,
  formatDuration,
} from '@/lib/analytics/calculations';

describe('calculateCacheEfficiency', () => {
  it('returns 0% when no cache usage', () => {
    expect(calculateCacheEfficiency(100000, 0)).toBe(0);
  });

  it('calculates efficiency correctly', () => {
    expect(calculateCacheEfficiency(125000, 80000)).toBeCloseTo(39.0, 1);
  });

  it('handles 100% cache efficiency', () => {
    expect(calculateCacheEfficiency(0, 100000)).toBe(100);
  });

  it('handles zero denominator', () => {
    expect(calculateCacheEfficiency(0, 0)).toBe(0);
  });

  it('calculates partial cache efficiency', () => {
    expect(calculateCacheEfficiency(50000, 50000)).toBe(50);
  });
});

describe('calculateSuccessRate', () => {
  it('calculates success rate correctly', () => {
    expect(calculateSuccessRate(80, 15, 5)).toBe(80);
  });

  it('handles 100% success rate', () => {
    expect(calculateSuccessRate(100, 0, 0)).toBe(100);
  });

  it('handles 0% success rate', () => {
    expect(calculateSuccessRate(0, 50, 25)).toBe(0);
  });

  it('returns null when no terminal jobs', () => {
    expect(calculateSuccessRate(0, 0, 0)).toBeNull();
  });

  it('rounds to appropriate precision', () => {
    expect(calculateSuccessRate(33, 67, 0)).toBeCloseTo(33.0, 1);
  });
});

describe('formatDuration', () => {
  it('formats seconds only', () => {
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(45000)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125000)).toBe('2m 5s');
    expect(formatDuration(154000)).toBe('2m 34s');
  });

  it('formats hours as minutes', () => {
    expect(formatDuration(3600000)).toBe('60m 0s');
  });

  it('rounds seconds properly', () => {
    expect(formatDuration(154500)).toBe('2m 35s'); // rounds up
    expect(formatDuration(154400)).toBe('2m 34s'); // rounds down
  });

  it('handles zero duration', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('handles sub-second durations', () => {
    expect(formatDuration(500)).toBe('1s'); // rounds up to 1s
  });
});

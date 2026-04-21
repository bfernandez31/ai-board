import { describe, expect, it } from 'vitest';
import {
  computeQuantileThresholds,
  computePeriodDates,
  generateGridDates,
  getIntensityLevel,
  formatDateKey,
} from '@/lib/heatmap/types';

describe('Heatmap Pure Logic', () => {
  describe('computeQuantileThresholds', () => {
    it('returns default thresholds for empty array', () => {
      const result = computeQuantileThresholds([]);
      expect(result).toEqual({ q25: 1, q50: 2, q75: 3, q90: 4 });
    });

    it('returns equal thresholds when all non-zero counts are the same', () => {
      const result = computeQuantileThresholds([5, 5, 5, 0, 5]);
      expect(result.q25).toBe(5);
      expect(result.q50).toBe(5);
      expect(result.q75).toBe(5);
      expect(result.q90).toBe(5);
    });

    it('computes quantiles for varied counts', () => {
      const counts = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = computeQuantileThresholds(counts);
      expect(result.q25).toBeGreaterThan(0);
      expect(result.q50).toBeGreaterThan(result.q25);
      expect(result.q75).toBeGreaterThan(result.q50);
      expect(result.q90).toBeGreaterThan(result.q75);
    });

    it('handles single non-zero value as max intensity', () => {
      const result = computeQuantileThresholds([0, 0, 3, 0]);
      expect(result.q25).toBe(3);
      expect(result.q50).toBe(3);
      expect(result.q75).toBe(3);
      expect(result.q90).toBe(3);
    });
  });

  describe('getIntensityLevel', () => {
    const thresholds = { q25: 2, q50: 5, q75: 8, q90: 10 };

    it('returns 0 for zero count', () => {
      expect(getIntensityLevel(0, thresholds)).toBe(0);
    });

    it('returns 1 for count <= q25', () => {
      expect(getIntensityLevel(1, thresholds)).toBe(1);
      expect(getIntensityLevel(2, thresholds)).toBe(1);
    });

    it('returns 2 for count > q25 and <= q50', () => {
      expect(getIntensityLevel(3, thresholds)).toBe(2);
      expect(getIntensityLevel(5, thresholds)).toBe(2);
    });

    it('returns 3 for count > q50 and <= q90', () => {
      expect(getIntensityLevel(6, thresholds)).toBe(3);
      expect(getIntensityLevel(8, thresholds)).toBe(3);
      expect(getIntensityLevel(10, thresholds)).toBe(3);
    });

    it('returns 4 for count > q90', () => {
      expect(getIntensityLevel(11, thresholds)).toBe(4);
      expect(getIntensityLevel(15, thresholds)).toBe(4);
    });

    it('maps all same-count active days to mid-intensity', () => {
      const sameThresholds = { q25: 5, q50: 5, q75: 5, q90: 5 };
      expect(getIntensityLevel(5, sameThresholds)).toBe(2);
    });
  });

  describe('computePeriodDates', () => {
    const now = new Date(2026, 3, 19); // April 19, 2026

    it('computes rolling period as ~365 days', () => {
      const { startDate, endDate } = computePeriodDates('rolling', now);
      expect(formatDateKey(endDate)).toBe('2026-04-19');
      expect(formatDateKey(startDate)).toBe('2025-04-20');
    });

    it('computes calendar year period for past year', () => {
      const { startDate, endDate } = computePeriodDates('2025', now);
      expect(formatDateKey(startDate)).toBe('2025-01-01');
      expect(formatDateKey(endDate)).toBe('2025-12-31');
    });

    it('computes calendar year period for current year (ends today)', () => {
      const { startDate, endDate } = computePeriodDates('2026', now);
      expect(formatDateKey(startDate)).toBe('2026-01-01');
      expect(formatDateKey(endDate)).toBe('2026-04-19');
    });
  });

  describe('generateGridDates', () => {
    it('generates dates starting on Sunday and ending on Saturday', () => {
      const start = new Date(2026, 0, 1); // Thursday
      const end = new Date(2026, 0, 31); // Saturday
      const dates = generateGridDates(start, end);

      const firstDate = dates[0]!.date;
      const lastDate = dates[dates.length - 1]!.date;

      expect(firstDate.getDay()).toBe(0); // Sunday
      expect(lastDate.getDay()).toBe(6); // Saturday
    });

    it('marks dates outside range as not in range (chipped corners)', () => {
      const start = new Date(2026, 0, 7); // Wednesday
      const end = new Date(2026, 0, 10); // Saturday
      const dates = generateGridDates(start, end);

      const outOfRange = dates.filter((d) => !d.inRange);
      const inRange = dates.filter((d) => d.inRange);

      expect(outOfRange.length).toBeGreaterThan(0);
      expect(inRange.length).toBe(4); // Jan 7-10
    });

    it('total dates are always a multiple of 7', () => {
      const start = new Date(2025, 3, 20);
      const end = new Date(2026, 3, 19);
      const dates = generateGridDates(start, end);
      expect(dates.length % 7).toBe(0);
    });
  });

  describe('formatDateKey', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date(2026, 0, 5);
      expect(formatDateKey(date)).toBe('2026-01-05');
    });

    it('pads single-digit months and days', () => {
      const date = new Date(2026, 2, 9);
      expect(formatDateKey(date)).toBe('2026-03-09');
    });
  });
});

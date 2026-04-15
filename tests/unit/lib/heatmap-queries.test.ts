import { describe, it, expect } from 'vitest';
import { computeQuartiles, getIntensityLevel } from '@/lib/heatmap/queries';

describe('heatmap query helpers', () => {
  describe('computeQuartiles', () => {
    it('returns empty array for empty input', () => {
      expect(computeQuartiles([])).toEqual([]);
    });

    it('returns empty array when all counts are zero', () => {
      expect(computeQuartiles([0, 0, 0])).toEqual([]);
    });

    it('computes quartiles for single non-zero value', () => {
      const result = computeQuartiles([5]);
      expect(result).toHaveLength(3);
      // Single value: all quartiles equal to that value
      expect(result[0]).toBe(5);
      expect(result[1]).toBe(5);
      expect(result[2]).toBe(5);
    });

    it('computes quartiles for varied data', () => {
      const counts = [1, 2, 3, 4, 5, 6, 7, 8];
      const result = computeQuartiles(counts);
      expect(result).toHaveLength(3);
      // Q1 ~ 2.75, Q2 ~ 4.5, Q3 ~ 6.25
      expect(result[0]).toBeCloseTo(2.75, 1);
      expect(result[1]).toBeCloseTo(4.5, 1);
      expect(result[2]).toBeCloseTo(6.25, 1);
    });

    it('filters out zero values before computing', () => {
      const counts = [0, 0, 5, 0, 10];
      const result = computeQuartiles(counts);
      expect(result).toHaveLength(3);
      // Non-zero sorted: [5, 10]
      expect(result[0]).toBeCloseTo(6.25, 1);
      expect(result[1]).toBeCloseTo(7.5, 1);
      expect(result[2]).toBeCloseTo(8.75, 1);
    });
  });

  describe('getIntensityLevel', () => {
    it('returns 0 for zero job count', () => {
      expect(getIntensityLevel(0, [2, 4, 6])).toBe(0);
    });

    it('returns 0 for empty quartiles', () => {
      expect(getIntensityLevel(5, [])).toBe(0);
    });

    it('returns level 1 for counts <= Q1', () => {
      expect(getIntensityLevel(1, [2, 4, 6])).toBe(1);
      expect(getIntensityLevel(2, [2, 4, 6])).toBe(1);
    });

    it('returns level 2 for counts <= Q2', () => {
      expect(getIntensityLevel(3, [2, 4, 6])).toBe(2);
      expect(getIntensityLevel(4, [2, 4, 6])).toBe(2);
    });

    it('returns level 3 for counts <= Q3', () => {
      expect(getIntensityLevel(5, [2, 4, 6])).toBe(3);
      expect(getIntensityLevel(6, [2, 4, 6])).toBe(3);
    });

    it('returns level 4 for counts > Q3', () => {
      expect(getIntensityLevel(7, [2, 4, 6])).toBe(4);
      expect(getIntensityLevel(100, [2, 4, 6])).toBe(4);
    });
  });
});

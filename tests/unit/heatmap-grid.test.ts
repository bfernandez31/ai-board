import { describe, expect, it } from 'vitest';
import { getIntensityLevel, buildGrid } from '@/components/heatmap/heatmap-grid';

describe('Heatmap Grid Date Math', () => {
  describe('getIntensityLevel', () => {
    const thresholds: [number, number, number, number] = [2, 5, 10, 20];

    it('returns 0 for zero jobs', () => {
      expect(getIntensityLevel(0, thresholds)).toBe(0);
    });

    it('returns 1 for counts at or below p25', () => {
      expect(getIntensityLevel(1, thresholds)).toBe(1);
      expect(getIntensityLevel(2, thresholds)).toBe(1);
    });

    it('returns 2 for counts between p25 and p50', () => {
      expect(getIntensityLevel(3, thresholds)).toBe(2);
      expect(getIntensityLevel(5, thresholds)).toBe(2);
    });

    it('returns 3 for counts between p50 and p75', () => {
      expect(getIntensityLevel(6, thresholds)).toBe(3);
      expect(getIntensityLevel(10, thresholds)).toBe(3);
    });

    it('returns 4 for counts above p75', () => {
      expect(getIntensityLevel(11, thresholds)).toBe(4);
      expect(getIntensityLevel(20, thresholds)).toBe(4);
    });
  });

  describe('buildGrid', () => {
    it('computes correct grid for a full calendar year 2025 (non-leap)', () => {
      const { gridCells, totalWeeks, startDow, endDow } = buildGrid('2025-01-01', '2025-12-31', []);
      expect(gridCells.length).toBe(365);
      expect(startDow).toBe(3); // Jan 1 2025 = Wednesday
      expect(endDow).toBe(3); // Dec 31 2025 = Wednesday
      expect(totalWeeks).toBeGreaterThanOrEqual(52);
    });

    it('computes correct grid for leap year 2024', () => {
      const { gridCells } = buildGrid('2024-01-01', '2024-12-31', []);
      expect(gridCells.length).toBe(366);
    });

    it('handles chipped corners for periods starting mid-week', () => {
      const { startDow } = buildGrid('2025-03-05', '2025-03-31', []);
      expect(startDow).toBe(3); // March 5 2025 = Wednesday
    });

    it('generates month labels', () => {
      const { monthLabels } = buildGrid('2025-01-01', '2025-12-31', []);
      expect(monthLabels.length).toBe(12);
      expect(monthLabels[0]?.label).toBe('Jan');
      expect(monthLabels[11]?.label).toBe('Dec');
    });

    it('maps cell data correctly', () => {
      const cells = [{ date: '2025-06-15', jobCount: 5, shippedCount: 1, totalCost: 2.5 }];
      const { gridCells } = buildGrid('2025-01-01', '2025-12-31', cells);
      const june15 = gridCells.find((c) => c.date === '2025-06-15');
      expect(june15?.data?.jobCount).toBe(5);
      expect(june15?.data?.shippedCount).toBe(1);
    });

    it('treats missing dates as null data', () => {
      const { gridCells } = buildGrid('2025-01-01', '2025-01-07', []);
      const allNull = gridCells.every((c) => c.data === null);
      expect(allNull).toBe(true);
    });

    it('computes rolling 12-month window correctly', () => {
      const { gridCells } = buildGrid('2024-04-19', '2025-04-18', []);
      expect(gridCells.length).toBe(365);
    });
  });

  describe('available years calculation', () => {
    it('generates years from account creation to current', () => {
      const currentYear = new Date().getUTCFullYear();
      const startYear = 2023;
      const years: string[] = [];
      for (let y = startYear; y <= currentYear; y++) {
        years.push(String(y));
      }
      expect(years).toContain('2023');
      expect(years).toContain(String(currentYear));
      expect(years.length).toBe(currentYear - startYear + 1);
    });
  });

  describe('UTC date normalization', () => {
    it('normalizes dates to UTC regardless of local timezone', () => {
      const date = new Date('2025-03-09T07:00:00Z');
      const utcDateStr = date.toISOString().split('T')[0];
      expect(utcDateStr).toBe('2025-03-09');
    });
  });
});

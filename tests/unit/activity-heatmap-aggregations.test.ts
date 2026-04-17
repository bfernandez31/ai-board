import { describe, expect, it } from 'vitest';
import {
  buildAvailablePeriods,
  buildHeatmapGrid,
  computeIntensityThresholds,
  formatISODate,
  getIntensityClass,
  getIntensityLevel,
  isValidPeriod,
  resolvePeriod,
} from '@/lib/activity-heatmap/aggregations';
import type { HeatmapDay } from '@/lib/activity-heatmap/types';

describe('activity-heatmap aggregations', () => {
  describe('isValidPeriod', () => {
    it('accepts last-12-months and 4-digit years', () => {
      expect(isValidPeriod('last-12-months')).toBe(true);
      expect(isValidPeriod('2024')).toBe(true);
      expect(isValidPeriod('2026')).toBe(true);
    });

    it('rejects malformed values', () => {
      expect(isValidPeriod('24')).toBe(false);
      expect(isValidPeriod('all')).toBe(false);
      expect(isValidPeriod('')).toBe(false);
    });
  });

  describe('resolvePeriod', () => {
    it('resolves last-12-months relative to now', () => {
      const now = new Date(2026, 2, 15); // March 15, 2026
      const period = resolvePeriod('last-12-months', now);
      expect(period.start.getFullYear()).toBe(2025);
      expect(period.start.getMonth()).toBe(2); // March
      expect(period.start.getDate()).toBe(16); // one day after a year ago → 365 days window
      expect(period.end.getTime()).toBeGreaterThanOrEqual(now.getTime());
    });

    it('resolves a calendar year to Jan 1 – Dec 31 boundaries', () => {
      const period = resolvePeriod('2024');
      expect(period.start.getFullYear()).toBe(2024);
      expect(period.start.getMonth()).toBe(0);
      expect(period.start.getDate()).toBe(1);
      expect(period.end.getFullYear()).toBe(2024);
      expect(period.end.getMonth()).toBe(11);
      expect(period.end.getDate()).toBe(31);
    });
  });

  describe('buildAvailablePeriods', () => {
    it('returns only last-12-months when user joined in the current year', () => {
      const now = new Date(2026, 3, 1);
      const userCreated = new Date(2026, 0, 15);
      const options = buildAvailablePeriods(userCreated, now);
      expect(options).toEqual([{ value: 'last-12-months', label: 'Last 12 months' }]);
    });

    it('lists every year from current year down to user-created year', () => {
      const now = new Date(2026, 5, 1);
      const userCreated = new Date(2023, 7, 20);
      const options = buildAvailablePeriods(userCreated, now);
      expect(options.map((o) => o.value)).toEqual([
        'last-12-months',
        '2026',
        '2025',
        '2024',
        '2023',
      ]);
    });
  });

  describe('buildHeatmapGrid', () => {
    it('creates 7 rows with chipped corners when period does not start/end on week boundaries', () => {
      // 2024-01-01 is a Monday → grid should start Sunday 2023-12-31, first col has Sunday-only cell,
      // with Mon–Sat of that column NOT in period.
      const start = new Date(2024, 0, 1); // Mon Jan 1, 2024
      const end = new Date(2024, 0, 7); // Sun Jan 7, 2024
      const grid = buildHeatmapGrid(start, end, []);

      expect(grid.rows).toHaveLength(7);
      // First column: Sunday Dec 31 2023 (not in period), rest of column days Jan 1 onwards in period
      const sundayRow = grid.rows[0]!;
      expect(sundayRow[0]!.date).toBe('2023-12-31');
      expect(sundayRow[0]!.inPeriod).toBe(false);
      expect(sundayRow[1]!.date).toBe('2024-01-07');
      expect(sundayRow[1]!.inPeriod).toBe(true);

      const mondayRow = grid.rows[1]!;
      expect(mondayRow[0]!.date).toBe('2024-01-01');
      expect(mondayRow[0]!.inPeriod).toBe(true);
    });

    it('attaches day data when a matching date is provided', () => {
      const start = new Date(2024, 0, 7); // Sun
      const end = new Date(2024, 0, 13); // Sat
      const days: HeatmapDay[] = [
        { date: '2024-01-10', jobCount: 5, totalCost: 1.23, ticketsShipped: 1 },
      ];
      const grid = buildHeatmapGrid(start, end, days);

      const wedRow = grid.rows[3]!;
      const cell = wedRow.find((c) => c.date === '2024-01-10');
      expect(cell).toBeDefined();
      expect(cell!.inPeriod).toBe(true);
      expect(cell!.data).toEqual(days[0]);
    });
  });

  describe('computeIntensityThresholds / getIntensityLevel', () => {
    it('returns deterministic thresholds when all counts are zero', () => {
      const thresholds = computeIntensityThresholds([]);
      expect(thresholds.level1).toBe(1);
      expect(getIntensityLevel(0, thresholds)).toBe(0);
      expect(getIntensityLevel(5, thresholds)).toBe(4);
    });

    it('distributes counts across 4 non-zero buckets', () => {
      const days: HeatmapDay[] = Array.from({ length: 4 }, (_, i) => ({
        date: `2024-01-0${i + 1}`,
        jobCount: (i + 1) * 5, // 5, 10, 15, 20
        totalCost: null,
        ticketsShipped: 0,
      }));
      const thresholds = computeIntensityThresholds(days);
      expect(getIntensityLevel(0, thresholds)).toBe(0);
      expect(getIntensityLevel(20, thresholds)).toBe(4);
      expect(getIntensityLevel(5, thresholds)).toBeLessThanOrEqual(2);
    });
  });

  describe('getIntensityClass', () => {
    it('maps levels to aurora cell classes', () => {
      expect(getIntensityClass(0)).toBe('aurora-heatmap-cell-0');
      expect(getIntensityClass(4)).toBe('aurora-heatmap-cell-4');
    });
  });

  describe('formatISODate', () => {
    it('formats a Date to YYYY-MM-DD in local time', () => {
      expect(formatISODate(new Date(2024, 0, 5, 10, 0, 0))).toBe('2024-01-05');
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildHeatmapGrid,
  computeIntensityLevels,
  getPeriodBounds,
  getMonthLabels,
  getDayLabels,
} from '@/lib/heatmap/utils';
import type { HeatmapDay } from '@/lib/heatmap/types';

describe('heatmap utils', () => {
  describe('getPeriodBounds', () => {
    it('returns last-12-months bounds Sunday-aligned', () => {
      const now = new Date('2026-04-15');
      const { start, end } = getPeriodBounds('last-12-months', now);

      // end should be the Saturday ending the current week (or today's week end)
      expect(end >= now).toBe(true);
      // start should be a Sunday
      expect(start.getDay()).toBe(0);
      // roughly 52 weeks back
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(363);
      expect(diffDays).toBeLessThanOrEqual(371);
    });

    it('returns calendar year bounds for a specific year', () => {
      const now = new Date('2026-04-15');
      const { start, end } = getPeriodBounds('2025', now);

      expect(start.getFullYear()).toBe(2025);
      expect(start.getMonth()).toBe(0);
      expect(start.getDate()).toBe(1);
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(11);
      expect(end.getDate()).toBe(31);
    });

    it('returns current year bounds for current year string', () => {
      const now = new Date('2026-04-15');
      const { start, end } = getPeriodBounds('2026', now);

      expect(start.getFullYear()).toBe(2026);
      expect(start.getMonth()).toBe(0);
      expect(start.getDate()).toBe(1);
      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(11);
      expect(end.getDate()).toBe(31);
    });
  });

  describe('buildHeatmapGrid', () => {
    it('produces 7 rows (days of week)', () => {
      const now = new Date('2026-04-15');
      const { start, end } = getPeriodBounds('last-12-months', now);
      const grid = buildHeatmapGrid([], start, end);

      expect(grid.length).toBe(7);
    });

    it('produces consistent column count across all rows', () => {
      const now = new Date('2026-04-15');
      const { start, end } = getPeriodBounds('last-12-months', now);
      const grid = buildHeatmapGrid([], start, end);

      const colCount = grid[0]!.length;
      for (const row of grid) {
        expect(row.length).toBe(colCount);
      }
      // Expect around 53 columns for 52 weeks
      expect(colCount).toBeGreaterThanOrEqual(52);
      expect(colCount).toBeLessThanOrEqual(54);
    });

    it('has chipped corners (null cells) for dates outside period bounds', () => {
      const { start, end } = getPeriodBounds('2025', new Date('2026-04-15'));
      const grid = buildHeatmapGrid([], start, end);

      // Jan 1 2025 is a Wednesday (day index 3), so rows 0-2 in first column should be null
      const jan1 = new Date('2025-01-01');
      const dayIndex = jan1.getDay(); // 3 = Wednesday
      for (let r = 0; r < dayIndex; r++) {
        expect(grid[r]![0]).toBeNull();
      }
      // The cell at dayIndex in first column should be a valid cell
      expect(grid[dayIndex]![0]).not.toBeNull();
    });

    it('populates job data from days array', () => {
      const now = new Date('2026-04-15');
      const { start, end } = getPeriodBounds('last-12-months', now);
      const days: HeatmapDay[] = [
        { date: '2026-04-14', jobCount: 5, costUsd: 2.5, shippedTickets: ['AIB-1'] },
        { date: '2026-04-15', jobCount: 3, costUsd: null, shippedTickets: [] },
      ];
      const grid = buildHeatmapGrid(days, start, end);

      // Find the cell for April 14
      const allCells = grid.flat().filter((c) => c !== null);
      const apr14 = allCells.find((c) => {
        const d = c!.date;
        return d.getFullYear() === 2026 && d.getMonth() === 3 && d.getDate() === 14;
      });
      expect(apr14).toBeDefined();
      expect(apr14!.jobCount).toBe(5);
      expect(apr14!.costUsd).toBe(2.5);
      expect(apr14!.shippedTickets).toEqual(['AIB-1']);
    });

    it('defaults empty days to jobCount 0', () => {
      const now = new Date('2026-04-15');
      const { start, end } = getPeriodBounds('last-12-months', now);
      const grid = buildHeatmapGrid([], start, end);

      const allCells = grid.flat().filter((c) => c !== null);
      expect(allCells.length).toBeGreaterThan(0);
      for (const cell of allCells) {
        expect(cell!.jobCount).toBe(0);
      }
    });
  });

  describe('computeIntensityLevels', () => {
    it('assigns level 0 to all cells when all have zero jobs', () => {
      const cells = [
        { date: new Date(), jobCount: 0, level: 0 as const, costUsd: null, shippedTickets: [] },
        { date: new Date(), jobCount: 0, level: 0 as const, costUsd: null, shippedTickets: [] },
      ];
      const result = computeIntensityLevels(cells);
      for (const cell of result) {
        expect(cell.level).toBe(0);
      }
    });

    it('assigns level 4 to the only active day', () => {
      const cells = [
        { date: new Date(), jobCount: 0, level: 0 as const, costUsd: null, shippedTickets: [] },
        { date: new Date(), jobCount: 5, level: 0 as const, costUsd: null, shippedTickets: [] },
        { date: new Date(), jobCount: 0, level: 0 as const, costUsd: null, shippedTickets: [] },
      ];
      const result = computeIntensityLevels(cells);
      const active = result.find((c) => c.jobCount === 5);
      expect(active!.level).toBe(4);
    });

    it('distributes levels across quartiles', () => {
      const counts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const cells = counts.map((jobCount) => ({
        date: new Date(),
        jobCount,
        level: 0 as const,
        costUsd: null,
        shippedTickets: [] as string[],
      }));
      const result = computeIntensityLevels(cells);

      // All levels 1-4 should be represented
      const levels = new Set(result.map((c) => c.level));
      expect(levels.has(1)).toBe(true);
      expect(levels.has(2)).toBe(true);
      expect(levels.has(3)).toBe(true);
      expect(levels.has(4)).toBe(true);
    });

    it('handles all same count by assigning level 4', () => {
      const cells = Array.from({ length: 5 }, () => ({
        date: new Date(),
        jobCount: 3,
        level: 0 as const,
        costUsd: null,
        shippedTickets: [] as string[],
      }));
      const result = computeIntensityLevels(cells);
      for (const cell of result) {
        expect(cell.level).toBe(4);
      }
    });

    it('handles sparse data (mostly zeros)', () => {
      const cells = [
        ...Array.from({ length: 50 }, () => ({
          date: new Date(),
          jobCount: 0,
          level: 0 as const,
          costUsd: null,
          shippedTickets: [] as string[],
        })),
        { date: new Date(), jobCount: 1, level: 0 as const, costUsd: null, shippedTickets: [] as string[] },
        { date: new Date(), jobCount: 2, level: 0 as const, costUsd: null, shippedTickets: [] as string[] },
      ];
      const result = computeIntensityLevels(cells);
      const zeros = result.filter((c) => c.jobCount === 0);
      const nonZeros = result.filter((c) => c.jobCount > 0);
      for (const cell of zeros) {
        expect(cell.level).toBe(0);
      }
      for (const cell of nonZeros) {
        expect(cell.level).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('getMonthLabels', () => {
    it('returns labels for months in the period', () => {
      const now = new Date('2026-04-15');
      const { start, end } = getPeriodBounds('last-12-months', now);
      const labels = getMonthLabels(start, end);

      expect(labels.length).toBeGreaterThanOrEqual(12);
      // Check that labels have text and column index
      for (const label of labels) {
        expect(label.text).toBeTruthy();
        expect(typeof label.column).toBe('number');
        expect(label.column).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns correct month names', () => {
      const { start, end } = getPeriodBounds('2025', new Date('2026-04-15'));
      const labels = getMonthLabels(start, end);
      const monthNames = labels.map((l) => l.text);
      expect(monthNames).toContain('Jan');
      expect(monthNames).toContain('Dec');
    });
  });

  describe('getDayLabels', () => {
    it('returns Mon, Wed, Fri labels', () => {
      const labels = getDayLabels();
      expect(labels).toEqual([
        { text: 'Mon', row: 1 },
        { text: 'Wed', row: 3 },
        { text: 'Fri', row: 5 },
      ]);
    });
  });
});

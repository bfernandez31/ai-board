import { describe, expect, it } from 'vitest';
import {
  buildAvailableYears,
  getPeriodBounds,
  parsePeriodFilter,
  isValidAgentFilter,
  formatUtcDate,
} from '@/lib/heatmap/aggregations';
import { buildGridLayout, computeLevel } from '@/lib/heatmap/grid';
import type { HeatmapDay } from '@/lib/heatmap/types';

describe('heatmap aggregations', () => {
  describe('parsePeriodFilter', () => {
    it('defaults to last12 for null or "last12"', () => {
      expect(parsePeriodFilter(null)).toBe('last12');
      expect(parsePeriodFilter('last12')).toBe('last12');
    });

    it('parses four-digit year strings', () => {
      expect(parsePeriodFilter('2024')).toBe(2024);
    });

    it('rejects malformed period values', () => {
      expect(parsePeriodFilter('foo')).toBeNull();
      expect(parsePeriodFilter('20')).toBeNull();
      expect(parsePeriodFilter('20249')).toBeNull();
    });
  });

  describe('isValidAgentFilter', () => {
    it('accepts all valid agents and "all"', () => {
      expect(isValidAgentFilter('all')).toBe(true);
      expect(isValidAgentFilter('CLAUDE')).toBe(true);
      expect(isValidAgentFilter('CODEX')).toBe(true);
      expect(isValidAgentFilter('MISTRAL')).toBe(true);
      expect(isValidAgentFilter('GEMINI')).toBe(true);
    });

    it('rejects unknown values', () => {
      expect(isValidAgentFilter(null)).toBe(false);
      expect(isValidAgentFilter('')).toBe(false);
      expect(isValidAgentFilter('claude')).toBe(false);
      expect(isValidAgentFilter('OTHER')).toBe(false);
    });
  });

  describe('getPeriodBounds', () => {
    it('returns a rolling 12-month (365-day) window for "last12"', () => {
      const now = new Date('2026-04-19T12:00:00Z');
      const bounds = getPeriodBounds('last12', now);
      expect(formatUtcDate(bounds.end)).toBe('2026-04-19');
      expect(formatUtcDate(bounds.start)).toBe('2025-04-20');
    });

    it('returns the full calendar year for a past year', () => {
      const now = new Date('2026-04-19T12:00:00Z');
      const bounds = getPeriodBounds(2024, now);
      expect(formatUtcDate(bounds.start)).toBe('2024-01-01');
      expect(formatUtcDate(bounds.end)).toBe('2024-12-31');
    });

    it('clamps the current year to today', () => {
      const now = new Date('2026-04-19T12:00:00Z');
      const bounds = getPeriodBounds(2026, now);
      expect(formatUtcDate(bounds.start)).toBe('2026-01-01');
      expect(formatUtcDate(bounds.end)).toBe('2026-04-19');
    });
  });

  describe('buildAvailableYears', () => {
    it('returns an empty list when the user was created this year', () => {
      const now = new Date('2026-04-19T00:00:00Z');
      const createdAt = new Date('2026-01-05T00:00:00Z');
      expect(buildAvailableYears(createdAt, now)).toEqual([]);
    });

    it('returns years from current back to creation year (descending)', () => {
      const now = new Date('2026-04-19T00:00:00Z');
      const createdAt = new Date('2023-07-01T00:00:00Z');
      expect(buildAvailableYears(createdAt, now)).toEqual([2026, 2025, 2024, 2023]);
    });
  });
});

describe('heatmap grid', () => {
  describe('computeLevel', () => {
    it('returns 0 for no activity', () => {
      expect(computeLevel(0, 10)).toBe(0);
      expect(computeLevel(5, 0)).toBe(0);
    });

    it('buckets counts into four non-zero levels', () => {
      expect(computeLevel(1, 100)).toBe(1);
      expect(computeLevel(25, 100)).toBe(1);
      expect(computeLevel(26, 100)).toBe(2);
      expect(computeLevel(50, 100)).toBe(2);
      expect(computeLevel(51, 100)).toBe(3);
      expect(computeLevel(75, 100)).toBe(3);
      expect(computeLevel(76, 100)).toBe(4);
      expect(computeLevel(100, 100)).toBe(4);
    });
  });

  describe('buildGridLayout', () => {
    it('produces empty layout for invalid ranges', () => {
      expect(buildGridLayout('2024-02-10', '2024-02-01', []).columns).toEqual([]);
    });

    it('renders chipped top-left and bottom-right corners', () => {
      // 2024 starts on a Monday; 2024-12-31 is a Tuesday.
      const days: HeatmapDay[] = [
        { date: '2024-01-01', jobCount: 2, totalCost: 1, shipped: 0 },
      ];
      const layout = buildGridLayout('2024-01-01', '2024-12-31', days);
      expect(layout.columns.length).toBeGreaterThan(50);

      const firstColumn = layout.columns[0]!;
      // Sunday cell should be chipped (null), Monday (Jan 1) should be in-range.
      expect(firstColumn.cells[0]?.date).toBeNull();
      expect(firstColumn.cells[1]?.date).toBe('2024-01-01');

      const lastColumn = layout.columns[layout.columns.length - 1]!;
      // 2024-12-31 is a Tuesday (row index 2); Wed..Sat should be chipped.
      expect(lastColumn.cells[2]?.date).toBe('2024-12-31');
      expect(lastColumn.cells[3]?.date).toBeNull();
      expect(lastColumn.cells[6]?.date).toBeNull();
    });

    it('emits month labels only when the month changes', () => {
      const layout = buildGridLayout('2024-01-01', '2024-03-31', []);
      const labeled = layout.columns.filter((col) => col.monthLabel !== null);
      const uniqueLabels = labeled.map((col) => col.monthLabel);
      expect(uniqueLabels).toEqual(['Jan', 'Feb', 'Mar']);
    });

    it('fills in-range days with the matching level using the max count', () => {
      const days: HeatmapDay[] = [
        { date: '2024-01-01', jobCount: 1, totalCost: null, shipped: 0 },
        { date: '2024-01-02', jobCount: 4, totalCost: 0.5, shipped: 1 },
      ];
      const layout = buildGridLayout('2024-01-01', '2024-01-07', days);
      const firstColumn = layout.columns[0]!;
      // 2024-01-01 Monday (row 1), 2024-01-02 Tuesday (row 2)
      expect(firstColumn.cells[1]?.level).toBe(1); // 1/4 = 0.25 → level 1
      expect(firstColumn.cells[2]?.level).toBe(4);
      expect(firstColumn.cells[1]?.day?.jobCount).toBe(1);
      expect(firstColumn.cells[3]?.level).toBe(0); // no data
      expect(firstColumn.cells[3]?.day).toBeNull();
    });
  });
});

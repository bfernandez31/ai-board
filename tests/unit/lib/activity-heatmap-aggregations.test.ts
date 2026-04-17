import { describe, expect, it } from 'vitest';
import {
  buildHeatmapGrid,
  getAvailablePeriods,
  getIntensityLevel,
  getMaxJobCount,
  getPeriodBoundaries,
  getPeriodLabel,
  getYearFromPeriod,
  isValidPeriod,
  parseIsoDate,
  shouldShowYearSelector,
} from '@/lib/activity-heatmap/aggregations';
import type { HeatmapDay } from '@/lib/activity-heatmap/types';

describe('activity-heatmap/aggregations', () => {
  describe('isValidPeriod', () => {
    it('accepts last-12-months', () => {
      expect(isValidPeriod('last-12-months')).toBe(true);
    });
    it('accepts year-YYYY', () => {
      expect(isValidPeriod('year-2024')).toBe(true);
    });
    it('rejects invalid strings', () => {
      expect(isValidPeriod('year-24')).toBe(false);
      expect(isValidPeriod('nope')).toBe(false);
      expect(isValidPeriod('year-abcd')).toBe(false);
    });
  });

  describe('getYearFromPeriod', () => {
    it('returns year number for year-YYYY', () => {
      expect(getYearFromPeriod('year-2024')).toBe(2024);
    });
    it('returns null for last-12-months', () => {
      expect(getYearFromPeriod('last-12-months')).toBeNull();
    });
  });

  describe('getPeriodLabel', () => {
    it('labels last-12-months', () => {
      expect(getPeriodLabel('last-12-months')).toBe('Last 12 months');
    });
    it('labels year-YYYY', () => {
      expect(getPeriodLabel('year-2024')).toBe('2024');
    });
  });

  describe('getPeriodBoundaries', () => {
    it('returns Jan 1 to Dec 31 for a calendar year', () => {
      const { startDate, endDate } = getPeriodBoundaries('year-2024');
      expect(startDate.toISOString().slice(0, 10)).toBe('2024-01-01');
      expect(endDate.toISOString().slice(0, 10)).toBe('2024-12-31');
    });

    it('returns rolling 365-day window for last-12-months', () => {
      const now = new Date('2026-04-17T12:00:00Z');
      const { startDate, endDate } = getPeriodBoundaries('last-12-months', now);
      expect(endDate.toISOString().slice(0, 10)).toBe('2026-04-17');
      expect(startDate.toISOString().slice(0, 10)).toBe('2025-04-18');
    });
  });

  describe('getAvailablePeriods', () => {
    it('returns last-12-months + years from creation to now', () => {
      const created = new Date('2024-06-01T00:00:00Z');
      const now = new Date('2026-04-17T00:00:00Z');
      const periods = getAvailablePeriods(created, now);
      expect(periods).toEqual(['last-12-months', 'year-2026', 'year-2025', 'year-2024']);
    });

    it('returns only last-12-months when user created this year', () => {
      const created = new Date('2026-01-15T00:00:00Z');
      const now = new Date('2026-04-17T00:00:00Z');
      const periods = getAvailablePeriods(created, now);
      expect(periods).toEqual(['last-12-months', 'year-2026']);
    });
  });

  describe('shouldShowYearSelector', () => {
    it('hides selector when user created this year', () => {
      const created = new Date('2026-03-01T00:00:00Z');
      const now = new Date('2026-04-17T00:00:00Z');
      expect(shouldShowYearSelector(created, now)).toBe(false);
    });
    it('shows selector when account is older than this year', () => {
      const created = new Date('2024-03-01T00:00:00Z');
      const now = new Date('2026-04-17T00:00:00Z');
      expect(shouldShowYearSelector(created, now)).toBe(true);
    });
  });

  describe('getIntensityLevel', () => {
    it('returns 0 for zero jobs', () => {
      expect(getIntensityLevel(0, 10)).toBe(0);
    });
    it('returns 0 when maxJobCount is 0', () => {
      expect(getIntensityLevel(1, 0)).toBe(0);
    });
    it('scales progressively', () => {
      expect(getIntensityLevel(1, 10)).toBe(1);
      expect(getIntensityLevel(3, 10)).toBe(2);
      expect(getIntensityLevel(6, 10)).toBe(3);
      expect(getIntensityLevel(10, 10)).toBe(4);
    });
  });

  describe('getMaxJobCount', () => {
    it('returns 0 for empty array', () => {
      expect(getMaxJobCount([])).toBe(0);
    });
    it('returns max from days', () => {
      const days: HeatmapDay[] = [
        { date: '2026-01-01', jobCount: 2, totalCost: 0, hasCost: false, ticketsShipped: 0 },
        { date: '2026-01-02', jobCount: 5, totalCost: 0, hasCost: false, ticketsShipped: 0 },
        { date: '2026-01-03', jobCount: 1, totalCost: 0, hasCost: false, ticketsShipped: 0 },
      ];
      expect(getMaxJobCount(days)).toBe(5);
    });
  });

  describe('buildHeatmapGrid', () => {
    it('renders chipped top-left for a year that does not start on Sunday', () => {
      // 2024-01-01 was a Monday
      const startDate = parseIsoDate('2024-01-01');
      const endDate = parseIsoDate('2024-12-31');
      const { weeks } = buildHeatmapGrid([], startDate, endDate);

      // First week should have null for Sunday (day 0)
      expect(weeks[0]?.[0]).toBeNull();
      // Monday (day 1) should be populated with 2024-01-01
      expect(weeks[0]?.[1]?.date).toBe('2024-01-01');
    });

    it('renders chipped bottom-right when the year does not end on Saturday', () => {
      // 2024-12-31 was a Tuesday (day 2)
      const startDate = parseIsoDate('2024-01-01');
      const endDate = parseIsoDate('2024-12-31');
      const { weeks } = buildHeatmapGrid([], startDate, endDate);

      const lastWeek = weeks[weeks.length - 1];
      expect(lastWeek).toBeDefined();
      // Last week: Sunday (0), Monday (1), Tuesday (2) populated; Wed-Sat null
      expect(lastWeek?.[2]?.date).toBe('2024-12-31');
      expect(lastWeek?.[3]).toBeNull();
      expect(lastWeek?.[6]).toBeNull();
    });

    it('emits a month label when a new month begins', () => {
      const startDate = parseIsoDate('2024-01-01');
      const endDate = parseIsoDate('2024-02-29');
      const { monthLabels } = buildHeatmapGrid([], startDate, endDate);

      expect(monthLabels.length).toBeGreaterThanOrEqual(2);
      expect(monthLabels[0]?.month).toBe('Jan');
      expect(monthLabels.some((l) => l.month === 'Feb')).toBe(true);
    });

    it('fills each rendered cell with matching day data when present', () => {
      const startDate = parseIsoDate('2024-01-07');
      const endDate = parseIsoDate('2024-01-13');
      const days: HeatmapDay[] = [
        { date: '2024-01-08', jobCount: 3, totalCost: 1.5, hasCost: true, ticketsShipped: 1 },
      ];
      const { weeks } = buildHeatmapGrid(days, startDate, endDate);

      // 2024-01-07 is a Sunday
      expect(weeks[0]?.[1]?.day.jobCount).toBe(3);
      expect(weeks[0]?.[1]?.day.hasCost).toBe(true);
      // Missing days should default to zero
      expect(weeks[0]?.[2]?.day.jobCount).toBe(0);
    });
  });
});

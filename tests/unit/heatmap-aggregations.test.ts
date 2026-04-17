import { describe, expect, it } from 'vitest';
import {
  buildPeriodOptions,
  buildWeeks,
  fillDateRange,
  formatCost,
  getPeriodBounds,
  intensityClass,
  intensityLevel,
  isValidCalendarYear,
  isValidHeatmapAgent,
  isValidHeatmapPeriod,
  monthLabels,
  toISODate,
} from '@/lib/heatmap/aggregations';

describe('heatmap/aggregations', () => {
  describe('getPeriodBounds', () => {
    it('returns a 365-day rolling window for "last-12-months"', () => {
      const now = new Date('2026-04-17T10:00:00Z');
      const { start, end } = getPeriodBounds('last-12-months', now);

      expect(toISODate(end)).toBe('2026-04-17');
      expect(toISODate(start)).toBe('2025-04-18');
      const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000) + 1;
      expect(days).toBe(365);
    });

    it('returns Jan 1 – Dec 31 bounds for a calendar year', () => {
      const now = new Date('2026-04-17T10:00:00Z');
      const { start, end } = getPeriodBounds('2024', now);

      expect(toISODate(start)).toBe('2024-01-01');
      expect(toISODate(end)).toBe('2024-12-31');
    });

    it('clamps the end date to today when the period is the current year', () => {
      const now = new Date('2026-04-17T10:00:00Z');
      const { start, end } = getPeriodBounds('2026', now);

      expect(toISODate(start)).toBe('2026-01-01');
      expect(toISODate(end)).toBe('2026-04-17');
    });
  });

  describe('buildPeriodOptions', () => {
    it('shows only "Last 12 months" when the account was created this year', () => {
      const accountCreatedAt = new Date('2026-01-20T00:00:00Z');
      const now = new Date('2026-04-17T00:00:00Z');
      const options = buildPeriodOptions(accountCreatedAt, now);

      expect(options).toEqual([{ value: 'last-12-months', label: 'Last 12 months' }]);
    });

    it('lists every calendar year from the account creation year through the current year', () => {
      const accountCreatedAt = new Date('2023-06-12T00:00:00Z');
      const now = new Date('2026-04-17T00:00:00Z');
      const options = buildPeriodOptions(accountCreatedAt, now);

      expect(options).toEqual([
        { value: 'last-12-months', label: 'Last 12 months' },
        { value: '2026', label: '2026' },
        { value: '2025', label: '2025' },
        { value: '2024', label: '2024' },
        { value: '2023', label: '2023' },
      ]);
    });
  });

  describe('isValidHeatmapPeriod', () => {
    it('accepts the rolling sentinel and a valid year', () => {
      const now = new Date('2026-04-17T00:00:00Z');
      expect(isValidHeatmapPeriod('last-12-months', now)).toBe(true);
      expect(isValidHeatmapPeriod('2024', now)).toBe(true);
    });

    it('rejects malformed or out-of-range values', () => {
      const now = new Date('2026-04-17T00:00:00Z');
      expect(isValidHeatmapPeriod('', now)).toBe(false);
      expect(isValidHeatmapPeriod('abc', now)).toBe(false);
      expect(isValidHeatmapPeriod('2099', now)).toBe(false);
      expect(isValidCalendarYear('1969')).toBe(false);
    });
  });

  describe('isValidHeatmapAgent', () => {
    it('accepts "all" and every known named agent; rejects others', () => {
      expect(isValidHeatmapAgent('all')).toBe(true);
      expect(isValidHeatmapAgent('CLAUDE')).toBe(true);
      expect(isValidHeatmapAgent('GEMINI')).toBe(true);
      expect(isValidHeatmapAgent('UNKNOWN')).toBe(false);
    });
  });

  describe('buildWeeks', () => {
    it('chips the leading corner when the first day is not a Sunday', () => {
      // Jan 1, 2024 is a Monday -> 1 leading null slot expected
      const dates = fillDateRange(
        new Date(Date.UTC(2024, 0, 1)),
        new Date(Date.UTC(2024, 0, 14))
      );
      const weeks = buildWeeks(dates);

      expect(weeks[0]?.days[0]).toBeNull();
      expect(weeks[0]?.days[1]).toBe('2024-01-01');
      expect(weeks[0]?.days[6]).toBe('2024-01-06');
      expect(weeks[1]?.days[0]).toBe('2024-01-07');
    });

    it('chips the trailing corner when the last day is not a Saturday', () => {
      // Dec 31, 2024 is a Tuesday -> 4 trailing null slots (Wed..Sat)
      const dates = fillDateRange(
        new Date(Date.UTC(2024, 11, 29)), // Sunday
        new Date(Date.UTC(2024, 11, 31)) // Tuesday
      );
      const weeks = buildWeeks(dates);

      expect(weeks).toHaveLength(1);
      expect(weeks[0]?.days[0]).toBe('2024-12-29');
      expect(weeks[0]?.days[2]).toBe('2024-12-31');
      expect(weeks[0]?.days[3]).toBeNull();
      expect(weeks[0]?.days[6]).toBeNull();
    });

    it('returns no columns for an empty input', () => {
      expect(buildWeeks([])).toEqual([]);
    });
  });

  describe('monthLabels', () => {
    it('emits one label per month at the first column that touches it', () => {
      const dates = fillDateRange(
        new Date(Date.UTC(2024, 0, 1)),
        new Date(Date.UTC(2024, 2, 10))
      );
      const columns = buildWeeks(dates);
      const labels = monthLabels(columns);

      expect(labels[0]).toBe('Jan');
      expect(labels.filter((label) => label === 'Jan')).toHaveLength(1);
      expect(labels.includes('Feb')).toBe(true);
      expect(labels.includes('Mar')).toBe(true);
    });
  });

  describe('intensityLevel / intensityClass', () => {
    it('maps counts to quartile-based levels against the period max', () => {
      expect(intensityLevel(0, 10)).toBe(0);
      expect(intensityLevel(2, 10)).toBe(1);
      expect(intensityLevel(5, 10)).toBe(2);
      expect(intensityLevel(7, 10)).toBe(3);
      expect(intensityLevel(10, 10)).toBe(4);
    });

    it('returns level 0 when the whole period is empty', () => {
      expect(intensityLevel(0, 0)).toBe(0);
    });

    it('returns a static Tailwind utility class per level', () => {
      expect(intensityClass(0)).toContain('bg-muted');
      expect(intensityClass(1)).toContain('violet');
      expect(intensityClass(4)).toContain('violet');
    });
  });

  describe('formatCost', () => {
    it('shows two decimal places for amounts ≥ $0.01', () => {
      expect(formatCost(0.01)).toBe('$0.01');
      expect(formatCost(1.234)).toBe('$1.23');
      expect(formatCost(12.5)).toBe('$12.50');
    });

    it('reports "<$0.01" for tiny positive amounts to avoid a misleading "$0"', () => {
      expect(formatCost(0.004)).toBe('<$0.01');
    });

    it('returns "$0.00" for exact zero', () => {
      expect(formatCost(0)).toBe('$0.00');
    });
  });

  describe('fillDateRange', () => {
    it('emits every ISO date inclusively', () => {
      const dates = fillDateRange(
        new Date(Date.UTC(2024, 0, 1)),
        new Date(Date.UTC(2024, 0, 3))
      );
      expect(dates).toEqual(['2024-01-01', '2024-01-02', '2024-01-03']);
    });
  });
});

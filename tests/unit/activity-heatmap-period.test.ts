import { describe, it, expect } from 'vitest';
import {
  buildGrid,
  formatHeatmapDate,
  getAvailableYears,
  getIntensityBucket,
  resolvePeriod,
  utcDate,
} from '@/lib/activity-heatmap/period';

describe('resolvePeriod', () => {
  it('rolling "last-12-months" ends today and starts the next day a year ago', () => {
    const now = utcDate(2026, 3, 17); // 2026-04-17 UTC
    const period = resolvePeriod('last-12-months', now);
    expect(period.kind).toBe('rolling');
    expect(period.label).toBe('Last 12 months');
    expect(period.end).toBe('2026-04-17');
    // 365 (or 366) days back, exclusive
    expect(period.start).toBe('2025-04-18');
  });

  it('a 4-digit year resolves to Jan 1 - Dec 31 of that year', () => {
    const period = resolvePeriod('2024');
    expect(period.kind).toBe('year');
    expect(period.year).toBe(2024);
    expect(period.label).toBe('2024');
    expect(period.start).toBe('2024-01-01');
    expect(period.end).toBe('2024-12-31');
  });

  it('falls back to rolling when an unknown string is supplied', () => {
    const now = utcDate(2026, 3, 17);
    const period = resolvePeriod('whatever', now);
    expect(period.kind).toBe('rolling');
  });
});

describe('getAvailableYears', () => {
  it('returns no years when the user signed up this calendar year', () => {
    const now = utcDate(2026, 3, 17);
    const created = utcDate(2026, 0, 5);
    expect(getAvailableYears(created, now)).toEqual([]);
  });

  it('returns each prior calendar year in descending order, excluding the current year', () => {
    const now = utcDate(2026, 3, 17);
    const created = utcDate(2023, 5, 1);
    expect(getAvailableYears(created, now)).toEqual([2025, 2024, 2023]);
  });
});

describe('buildGrid (chipped corners)', () => {
  it('chips the top-left when the year does not start on Sunday (2024 starts Monday)', () => {
    const grid = buildGrid({
      kind: 'year',
      year: 2024,
      label: '2024',
      start: '2024-01-01',
      end: '2024-12-31',
    });
    // 2024 starts on a Monday → row[0][0] (Sunday Dec 31, 2023) is out of period
    expect(grid.rows[0]![0]!.inPeriod).toBe(false);
    expect(grid.rows[0]![0]!.date).toBeNull();
    // row[1][0] should be Monday 2024-01-01, in period
    expect(grid.rows[1]![0]!.inPeriod).toBe(true);
    expect(grid.rows[1]![0]!.date).toBe('2024-01-01');
  });

  it('chips the bottom-right when the year does not end on Saturday', () => {
    const grid = buildGrid({
      kind: 'year',
      year: 2024,
      label: '2024',
      start: '2024-01-01',
      end: '2024-12-31',
    });
    // 2024-12-31 is a Tuesday → cells after Tuesday in last week are out of period
    const lastWeek = grid.weekCount - 1;
    // Wednesday (day 3) of last week is past end
    expect(grid.rows[3]![lastWeek]!.inPeriod).toBe(false);
    expect(grid.rows[3]![lastWeek]!.date).toBeNull();
    // Tuesday (day 2) of last week is the last day of the period
    expect(grid.rows[2]![lastWeek]!.inPeriod).toBe(true);
    expect(grid.rows[2]![lastWeek]!.date).toBe('2024-12-31');
  });

  it('produces 7 rows with an integer number of week columns', () => {
    const grid = buildGrid(resolvePeriod('2024'));
    expect(grid.rows.length).toBe(7);
    expect(Number.isInteger(grid.weekCount)).toBe(true);
    for (const row of grid.rows) {
      expect(row.length).toBe(grid.weekCount);
    }
  });

  it('labels each month exactly once and skips out-of-period leading column', () => {
    const grid = buildGrid(resolvePeriod('2024'));
    const labelsSeen = grid.monthLabels.filter((label) => label !== '');
    // Should contain unique month tokens, each appearing at most once
    expect(new Set(labelsSeen).size).toBe(labelsSeen.length);
    // 2024 first column is Sunday Dec 31 2023 (out of period); the
    // first labeled column should therefore be January 2024.
    expect(labelsSeen[0]).toBe('Jan');
  });
});

describe('getIntensityBucket', () => {
  it('returns 0 for zero job count', () => {
    expect(getIntensityBucket(0, 10)).toBe(0);
    expect(getIntensityBucket(5, 0)).toBe(0);
  });

  it('returns 4 for the maximum value', () => {
    expect(getIntensityBucket(10, 10)).toBe(4);
  });

  it('returns 1, 2, 3, 4 for the four quartile bands', () => {
    expect(getIntensityBucket(1, 8)).toBe(1);   // 0.125
    expect(getIntensityBucket(2, 8)).toBe(1);   // 0.25
    expect(getIntensityBucket(3, 8)).toBe(2);   // 0.375
    expect(getIntensityBucket(4, 8)).toBe(2);   // 0.5
    expect(getIntensityBucket(5, 8)).toBe(3);   // 0.625
    expect(getIntensityBucket(6, 8)).toBe(3);   // 0.75
    expect(getIntensityBucket(7, 8)).toBe(4);
  });
});

describe('formatHeatmapDate', () => {
  it('formats an ISO date in UTC with weekday + month/day/year', () => {
    expect(formatHeatmapDate('2024-04-17')).toBe('Wed, Apr 17, 2024');
    expect(formatHeatmapDate('2024-12-31')).toBe('Tue, Dec 31, 2024');
  });
});

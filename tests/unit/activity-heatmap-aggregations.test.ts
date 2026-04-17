import { describe, expect, it } from 'vitest';
import {
  addDays,
  buildHeatmapGrid,
  computeIntensityThresholds,
  diffInDays,
  formatHeatmapCost,
  formatTooltipDate,
  getAvailableYears,
  getIntensityBucket,
  getPeriodBoundaries,
  parseIsoDate,
  toIsoDate,
} from '@/lib/activity-heatmap/aggregations';

describe('activity-heatmap aggregations — date utilities', () => {
  it('toIsoDate emits YYYY-MM-DD using UTC components', () => {
    expect(toIsoDate(new Date(Date.UTC(2025, 0, 1)))).toBe('2025-01-01');
    expect(toIsoDate(new Date(Date.UTC(2024, 11, 31)))).toBe('2024-12-31');
  });

  it('parseIsoDate / toIsoDate round-trip', () => {
    expect(toIsoDate(parseIsoDate('2025-03-04'))).toBe('2025-03-04');
  });

  it('addDays / diffInDays are inverse operations', () => {
    const base = parseIsoDate('2025-01-15');
    expect(diffInDays(base, addDays(base, 30))).toBe(30);
    expect(diffInDays(addDays(base, -7), base)).toBe(7);
  });
});

describe('getAvailableYears', () => {
  const now = new Date(Date.UTC(2026, 3, 17));

  it('returns empty list when account was created in the current year', () => {
    expect(getAvailableYears(2026, now)).toEqual([]);
  });

  it('returns descending years from current down to account creation', () => {
    expect(getAvailableYears(2024, now)).toEqual([2026, 2025, 2024]);
  });

  it('handles single previous year', () => {
    expect(getAvailableYears(2025, now)).toEqual([2026, 2025]);
  });
});

describe('getPeriodBoundaries', () => {
  const now = new Date(Date.UTC(2026, 3, 17));

  it('rolling 12 months: 365-day inclusive window ending today', () => {
    const { start, end } = getPeriodBoundaries('last-12-months', now);
    expect(toIsoDate(end)).toBe('2026-04-17');
    expect(diffInDays(start, end)).toBe(364);
    expect(toIsoDate(start)).toBe('2025-04-18');
  });

  it('past calendar year: full Jan 1 → Dec 31', () => {
    const { start, end } = getPeriodBoundaries(2024, now);
    expect(toIsoDate(start)).toBe('2024-01-01');
    expect(toIsoDate(end)).toBe('2024-12-31');
  });

  it('current year: Jan 1 → today (clipped)', () => {
    const { start, end } = getPeriodBoundaries(2026, now);
    expect(toIsoDate(start)).toBe('2026-01-01');
    expect(toIsoDate(end)).toBe('2026-04-17');
  });
});

describe('buildHeatmapGrid', () => {
  it('chips the top-left for a year that does not start on Sunday', () => {
    // 2024-01-01 is a Monday.
    const start = parseIsoDate('2024-01-01');
    const end = parseIsoDate('2024-12-31');
    const grid = buildHeatmapGrid(start, end);

    // First column: Sunday cell (Dec 31, 2023) is OUT of range, so date should be null.
    expect(grid.columns[0]?.[0]?.date).toBeNull();
    // Monday Jan 1 is in range
    expect(grid.columns[0]?.[1]?.date).toBe('2024-01-01');
  });

  it('chips the bottom-right for a year that does not end on Saturday', () => {
    // 2024-12-31 is a Tuesday → weekday index 2. Cells for Wed/Thu/Fri/Sat in the last
    // column should be null.
    const start = parseIsoDate('2024-01-01');
    const end = parseIsoDate('2024-12-31');
    const grid = buildHeatmapGrid(start, end);
    const lastColumn = grid.columns[grid.columns.length - 1];
    expect(lastColumn?.[2]?.date).toBe('2024-12-31');
    expect(lastColumn?.[3]?.date).toBeNull();
    expect(lastColumn?.[6]?.date).toBeNull();
  });

  it('every column has exactly 7 rows', () => {
    const grid = buildHeatmapGrid(parseIsoDate('2024-01-01'), parseIsoDate('2024-12-31'));
    for (const col of grid.columns) {
      expect(col).toHaveLength(7);
    }
  });

  it('produces month labels at the start of new months', () => {
    const grid = buildHeatmapGrid(parseIsoDate('2024-01-01'), parseIsoDate('2024-12-31'));
    const labels = grid.monthLabels.filter((l): l is string => l !== null);
    expect(labels).toContain('Jan');
    expect(labels).toContain('Dec');
  });
});

describe('intensity bucketing', () => {
  it('zero counts always map to bucket 0', () => {
    expect(getIntensityBucket(0, [1, 2, 3, 4])).toBe(0);
  });

  it('uses 1..max thresholds for tiny datasets', () => {
    const thresholds = computeIntensityThresholds([0, 1, 2, 3, 4]);
    expect(getIntensityBucket(1, thresholds)).toBe(1);
    expect(getIntensityBucket(4, thresholds)).toBe(4);
  });

  it('returns flat zeros when there is no activity', () => {
    expect(computeIntensityThresholds([0, 0, 0])).toEqual([0, 0, 0, 0]);
  });

  it('larger datasets bucket by quartile', () => {
    const counts = [1, 2, 3, 5, 8, 13, 21, 34, 55, 100];
    const thresholds = computeIntensityThresholds(counts);
    expect(thresholds[3]).toBeGreaterThanOrEqual(100);
    expect(getIntensityBucket(100, thresholds)).toBe(4);
    expect(getIntensityBucket(1, thresholds)).toBeGreaterThanOrEqual(1);
  });
});

describe('formatters', () => {
  it('formatHeatmapCost: small amounts keep 2 decimals', () => {
    expect(formatHeatmapCost(0.04)).toBe('$0.04');
    expect(formatHeatmapCost(12.345)).toBe('$12.35');
  });

  it('formatHeatmapCost: large amounts drop decimals', () => {
    expect(formatHeatmapCost(123.45)).toBe('$123');
  });

  it('formatTooltipDate: returns weekday + date', () => {
    const formatted = formatTooltipDate('2025-03-04');
    expect(formatted).toMatch(/Mar/);
    expect(formatted).toMatch(/2025/);
  });
});

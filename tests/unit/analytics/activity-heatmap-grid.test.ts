import { describe, expect, it } from 'vitest';
import {
  buildHeatmapGrid,
  formatCellDate,
  getIntensityBucket,
} from '@/lib/analytics/activity-heatmap-grid';
import type { HeatmapCell } from '@/lib/analytics/activity-heatmap';

function emptyCell(date: string, jobCount = 0, ticketsShipped = 0): HeatmapCell {
  return { date, jobCount, totalCost: null, ticketsShipped };
}

function rangeCells(start: string, endInclusive: string, jobCount = 0): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = endInclusive.split('-').map(Number);
  const cursor = new Date(Date.UTC(sy!, sm! - 1, sd!));
  const end = new Date(Date.UTC(ey!, em! - 1, ed!));
  while (cursor.getTime() <= end.getTime()) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
    cells.push(emptyCell(key, jobCount));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}

describe('buildHeatmapGrid', () => {
  it('returns empty grid for empty input', () => {
    const grid = buildHeatmapGrid([]);
    expect(grid).toEqual({ cells: [], columns: 0, months: [], maxJobCount: 0 });
  });

  it('creates chipped top-left corner when year starts on a Monday (2024)', () => {
    // 2024-01-01 is a Monday (UTC day of week = 1).
    // First column should only have cells for row 1..6 (Mon-Sat), no Sunday.
    const cells = rangeCells('2024-01-01', '2024-01-13'); // 13 days
    const grid = buildHeatmapGrid(cells);

    const firstColumnCells = grid.cells.filter((c) => c.col === 0);
    // First column has only 6 cells (Mon-Sat), row 0 (Sun) is missing.
    expect(firstColumnCells.map((c) => c.row).sort()).toEqual([1, 2, 3, 4, 5, 6]);

    // Second column should have Sun-Sat (rows 0-6)
    const secondColumnCells = grid.cells.filter((c) => c.col === 1);
    expect(secondColumnCells).toHaveLength(7);
  });

  it('creates chipped bottom-right corner when period ends mid-week', () => {
    // 2024-12-31 is a Tuesday. Last column should be only Sun, Mon, Tue (rows 0-2).
    // Use a short range ending on 2024-12-31
    const cells = rangeCells('2024-12-29', '2024-12-31'); // Sun,Mon,Tue
    const grid = buildHeatmapGrid(cells);

    // Jan 1, 2024 isn't in this range; 2024-12-29 is a Sunday (firstDow=0)
    expect(grid.cells.every((c) => c.col === 0)).toBe(true);
    expect(grid.cells.map((c) => c.row).sort()).toEqual([0, 1, 2]);
  });

  it('computes maxJobCount across cells', () => {
    const cells = [
      emptyCell('2025-01-05', 3),
      emptyCell('2025-01-06', 10),
      emptyCell('2025-01-07', 7),
    ];
    const grid = buildHeatmapGrid(cells);
    expect(grid.maxJobCount).toBe(10);
  });

  it('emits month labels with the column where that month starts', () => {
    const cells = rangeCells('2025-01-01', '2025-03-31');
    const grid = buildHeatmapGrid(cells);
    const labels = grid.months.map((m) => m.label);
    expect(labels).toContain('Jan');
    expect(labels).toContain('Feb');
    expect(labels).toContain('Mar');
  });
});

describe('getIntensityBucket', () => {
  it('returns 0 when jobCount is zero', () => {
    expect(getIntensityBucket(0, 10)).toBe(0);
  });

  it('returns 0 when max is zero (no activity in period)', () => {
    expect(getIntensityBucket(5, 0)).toBe(0);
  });

  it('buckets proportionally from 1 to 4', () => {
    expect(getIntensityBucket(1, 10)).toBe(1); // 0.1 → bucket 1
    expect(getIntensityBucket(3, 10)).toBe(2); // 0.3 → bucket 2
    expect(getIntensityBucket(6, 10)).toBe(3); // 0.6 → bucket 3
    expect(getIntensityBucket(10, 10)).toBe(4); // 1.0 → bucket 4
  });
});

describe('formatCellDate', () => {
  it('formats a YYYY-MM-DD as a locale-friendly string', () => {
    const result = formatCellDate('2025-03-15');
    // Example output: "Sat, Mar 15, 2025"
    expect(result).toContain('Mar');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });
});

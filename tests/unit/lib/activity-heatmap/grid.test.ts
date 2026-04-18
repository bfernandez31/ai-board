import { describe, expect, it } from 'vitest';
import {
  buildHeatmapGrid,
  buildMonthLabels,
  getIntensityLevel,
} from '@/lib/activity-heatmap/grid';
import type { HeatmapDay } from '@/lib/activity-heatmap/types';

function emptyDay(date: string): HeatmapDay {
  return { date, jobCount: 0, totalCost: 0, costIncomplete: false, shippedTickets: [] };
}

describe('buildHeatmapGrid', () => {
  it('produces a week-column grid with chipped corners when the period does not align to Sunday', () => {
    // 2024-01-01 is a Monday, 2024-01-13 is a Saturday → Sun–Sat weeks
    // cover 2023-12-31..2024-01-06 and 2024-01-07..2024-01-13 (2 columns)
    const weeks = buildHeatmapGrid('2024-01-01', '2024-01-13', []);

    expect(weeks).toHaveLength(2);
    // First column: Sunday (2023-12-31) is BEFORE the period → chipped
    expect(weeks[0]!.cells[0]!.date).toBeNull();
    expect(weeks[0]!.cells[1]!.date).toBe('2024-01-01');
    // Last column: ends Saturday in-range
    expect(weeks[1]!.cells[6]!.date).toBe('2024-01-13');
  });

  it('places heatmap day data on matching cells and leaves the rest zeroed', () => {
    const day: HeatmapDay = {
      date: '2024-01-03',
      jobCount: 5,
      totalCost: 1.25,
      costIncomplete: false,
      shippedTickets: [],
    };
    const weeks = buildHeatmapGrid('2024-01-01', '2024-01-07', [day]);

    const jan3 = weeks[0]!.cells.find((c) => c.date === '2024-01-03');
    expect(jan3?.day).toEqual(day);
    const jan1 = weeks[0]!.cells.find((c) => c.date === '2024-01-01');
    expect(jan1?.day).toBeNull();
  });
});

describe('buildMonthLabels', () => {
  it('places the month label on the first week containing the new month, even mid-week', () => {
    // Week spanning Jan 28 (Sun) — Feb 3 (Sat) in 2024; Feb 1 is a Thursday.
    const weeks = buildHeatmapGrid(
      '2024-01-01',
      '2024-02-10',
      [emptyDay('2024-02-01')]
    );
    const labels = buildMonthLabels(weeks);

    const feb = labels.find((l) => l.label === 'Feb');
    expect(feb).toBeDefined();
    // The Jan 28 → Feb 3 column is at index 4 (weeks[4]). Previously the bug
    // would push "Feb" onto the Feb 4 column (index 5).
    expect(feb!.weekIndex).toBe(4);
  });

  it('emits one label per month and respects the appearance order', () => {
    const weeks = buildHeatmapGrid('2024-01-01', '2024-03-31', []);
    const labels = buildMonthLabels(weeks);

    const monthsInOrder = labels.map((l) => l.label);
    expect(monthsInOrder).toEqual(['Jan', 'Feb', 'Mar']);
  });
});

describe('getIntensityLevel', () => {
  it.each([
    [-1, 0],
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
    [9, 3],
    [10, 4],
    [100, 4],
  ])('maps %i jobs to intensity %i', (jobCount, expected) => {
    expect(getIntensityLevel(jobCount)).toBe(expected);
  });
});

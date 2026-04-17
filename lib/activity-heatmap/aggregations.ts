/**
 * Activity Heatmap Aggregation Utilities
 *
 * Pure date / grid math used by both the API queries and the UI components.
 * Working in UTC keeps the grid stable regardless of viewer timezone.
 */

import type { HeatmapPeriod } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Returns YYYY-MM-DD using the date's UTC components. */
export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parses a YYYY-MM-DD string into a UTC midnight Date. */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((part) => parseInt(part, 10));
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
}

/** Add `days` days to a UTC midnight date. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Inclusive day count between two UTC midnight dates. */
export function diffInDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
}

export interface PeriodBoundaries {
  /** Inclusive UTC midnight for the first day of the period. */
  start: Date;
  /** Inclusive UTC midnight for the last day of the period. */
  end: Date;
}

/**
 * Resolve the inclusive [start, end] day boundaries for a period.
 *
 * - 'last-12-months': rolling window of exactly 365 days ending today.
 * - <year>: full calendar year, but clipped to today when the year is the current one.
 */
export function getPeriodBoundaries(period: HeatmapPeriod, now: Date = new Date()): PeriodBoundaries {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (period === 'last-12-months') {
    return { start: addDays(today, -364), end: today };
  }

  const yearStart = new Date(Date.UTC(period, 0, 1));
  const yearEnd = new Date(Date.UTC(period, 11, 31));
  // Clip the right edge to today when displaying the in-progress year.
  const end = yearEnd.getTime() > today.getTime() ? today : yearEnd;
  return { start: yearStart, end };
}

/** Years available in the dropdown, given the user's account creation year. */
export function getAvailableYears(accountCreatedYear: number, now: Date = new Date()): number[] {
  const currentYear = now.getUTCFullYear();
  if (accountCreatedYear >= currentYear) {
    return [];
  }
  const years: number[] = [];
  for (let y = currentYear; y >= accountCreatedYear; y -= 1) {
    years.push(y);
  }
  return years;
}

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface HeatmapGridCell {
  /** Column (week) index, 0-based. */
  weekIndex: number;
  /** Row index 0-6 where 0 is Sunday. */
  weekday: WeekdayIndex;
  /** YYYY-MM-DD or null for the chipped corners (cells outside the period). */
  date: string | null;
}

export interface HeatmapGrid {
  /** Week columns. Each is 7 cells (Sunday..Saturday); cells outside the period have date: null. */
  columns: HeatmapGridCell[][];
  /** Month label per column, only set on the column where the month first appears. */
  monthLabels: (string | null)[];
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Build the GitHub-style grid.
 *
 * Columns are calendar weeks running Sunday → Saturday. The first column starts on the
 * Sunday on or before `start`; cells before `start` are returned with date: null
 * (the chipped top-left corner). Same for the bottom-right after `end`.
 */
export function buildHeatmapGrid(start: Date, end: Date): HeatmapGrid {
  const startWeekday = start.getUTCDay() as WeekdayIndex;
  const firstColumnStart = addDays(start, -startWeekday);
  const endWeekday = end.getUTCDay() as WeekdayIndex;
  const lastColumnStart = addDays(end, -endWeekday);
  const columnCount = diffInDays(firstColumnStart, lastColumnStart) / 7 + 1;

  const columns: HeatmapGridCell[][] = [];
  const monthLabels: (string | null)[] = [];
  let lastMonthLabeled: number | null = null;

  for (let w = 0; w < columnCount; w += 1) {
    const week: HeatmapGridCell[] = [];
    let columnFirstRealDay: Date | null = null;

    for (let d = 0; d < 7; d += 1) {
      const cellDate = addDays(firstColumnStart, w * 7 + d);
      const inRange = cellDate.getTime() >= start.getTime() && cellDate.getTime() <= end.getTime();
      week.push({
        weekIndex: w,
        weekday: d as WeekdayIndex,
        date: inRange ? toIsoDate(cellDate) : null,
      });
      if (inRange && columnFirstRealDay === null) {
        columnFirstRealDay = cellDate;
      }
    }

    columns.push(week);

    // Month label: shown on a column whose first in-range cell is the first of a new month
    // (relative to the previous labeled column). This matches GitHub's behavior where the
    // "Mar" label sits above the week that contains March 1.
    if (columnFirstRealDay) {
      const month = columnFirstRealDay.getUTCMonth();
      const dayOfMonth = columnFirstRealDay.getUTCDate();
      // Label on the first column, or when this column starts a new calendar month
      // and we have at least 7 days from the label boundary so labels don't crowd.
      const isNewMonth = lastMonthLabeled === null || month !== lastMonthLabeled;
      if (isNewMonth && (lastMonthLabeled === null || dayOfMonth <= 7)) {
        monthLabels.push(MONTH_LABELS[month] ?? null);
        lastMonthLabeled = month;
      } else {
        monthLabels.push(null);
      }
    } else {
      monthLabels.push(null);
    }
  }

  return { columns, monthLabels };
}

/**
 * Compute intensity buckets (0..4) for a list of job counts.
 * 0 always maps to bucket 0 (no activity); non-zero counts are bucketed by quartile of
 * the non-zero distribution so that small/large datasets both look reasonable.
 */
export function computeIntensityThresholds(counts: number[]): number[] {
  const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) {
    return [0, 0, 0, 0];
  }
  const max = nonZero[nonZero.length - 1] ?? 0;
  if (max <= 4) {
    // For tiny datasets, use the value directly so 1 → bucket 1, 2 → 2, etc.
    return [1, 2, 3, 4];
  }
  const q = (p: number) => {
    const idx = Math.min(nonZero.length - 1, Math.floor(p * nonZero.length));
    return nonZero[idx] ?? 1;
  };
  return [Math.max(1, q(0.25)), Math.max(2, q(0.5)), Math.max(3, q(0.75)), Math.max(4, max)];
}

/** Map a job count to a bucket 0..4 using thresholds from {@link computeIntensityThresholds}. */
export function getIntensityBucket(count: number, thresholds: number[]): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= (thresholds[0] ?? 1)) return 1;
  if (count <= (thresholds[1] ?? 2)) return 2;
  if (count <= (thresholds[2] ?? 3)) return 3;
  return 4;
}

/** Format a date string for tooltip display (e.g. "Mon, Mar 4, 2025"). */
export function formatTooltipDate(iso: string): string {
  const date = parseIsoDate(iso);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Format USD amount, e.g. 12.345 → "$12.35", 0.04 → "$0.04". */
export function formatHeatmapCost(value: number): string {
  if (value >= 100) {
    return `$${value.toFixed(0)}`;
  }
  return `$${value.toFixed(2)}`;
}

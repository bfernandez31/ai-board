/**
 * Activity Heatmap Period & Grid Utilities
 *
 * Pure functions: build period boundaries from a `HeatmapPeriod`, derive
 * available years from a user's account creation date, and compute the
 * Sunday-aligned grid layout that matches GitHub's "chipped" contribution
 * graph.
 */

import type { HeatmapPeriod, HeatmapPeriodInfo } from './types';

/** YYYY-MM-DD in UTC */
export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Construct a UTC Date at 00:00 from year/month/day. */
export function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Parse a YYYY-MM-DD string to a midnight-aligned UTC Date. */
export function parseIsoDate(iso: string): Date {
  return utcDate(
    Number.parseInt(iso.slice(0, 4), 10),
    Number.parseInt(iso.slice(5, 7), 10) - 1,
    Number.parseInt(iso.slice(8, 10), 10)
  );
}

/** Add `days` to a UTC date and return a new Date (does not mutate). */
export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Number of full UTC days between two midnight-aligned dates (b - a). */
export function diffInDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

/** Returns true when value matches /^\d{4}$/ */
export function isYearString(value: string): boolean {
  return /^\d{4}$/.test(value);
}

/**
 * Resolve a `HeatmapPeriod` to a concrete inclusive [start, end] window.
 * `now` defaults to the current time in tests-friendly fashion.
 */
export function resolvePeriod(
  period: HeatmapPeriod,
  now: Date = new Date()
): HeatmapPeriodInfo {
  if (period !== 'last-12-months' && isYearString(period)) {
    const year = Number.parseInt(period, 10);
    return {
      start: toIsoDate(utcDate(year, 0, 1)),
      end: toIsoDate(utcDate(year, 11, 31)),
      label: String(year),
      kind: 'year',
      year,
    };
  }

  const todayUtc = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const startUtc = utcDate(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1);

  return {
    start: toIsoDate(startUtc),
    end: toIsoDate(todayUtc),
    label: 'Last 12 months',
    kind: 'rolling',
  };
}

/**
 * Calendar years selectable in the year-selector dropdown.
 * Excludes the current year (which is covered by "Last 12 months") and
 * any year before the user's account creation date. Returned in
 * descending order.
 */
export function getAvailableYears(
  userCreatedAt: Date,
  now: Date = new Date()
): number[] {
  const currentYear = now.getUTCFullYear();
  const startYear = userCreatedAt.getUTCFullYear();
  if (startYear >= currentYear) {
    return [];
  }
  const years: number[] = [];
  for (let y = currentYear - 1; y >= startYear; y--) {
    years.push(y);
  }
  return years;
}

export interface HeatmapGridCell {
  /** YYYY-MM-DD or null when the cell falls outside the period */
  date: string | null;
  /** True when this cell is between period.start and period.end (inclusive) */
  inPeriod: boolean;
}

export interface HeatmapGrid {
  /** Total number of week columns */
  weekCount: number;
  /**
   * 7 rows × weekCount columns. `rows[dayOfWeek][weekIndex]` where
   * `dayOfWeek === 0` is Sunday.
   */
  rows: HeatmapGridCell[][];
  /**
   * Month label per column. Each column shows the month label only on
   * the first column of that month; other columns are empty strings.
   */
  monthLabels: string[];
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Build the GitHub-style Sunday-aligned grid for a period. Cells before
 * `start` (top-left) and after `end` (bottom-right) are marked
 * `inPeriod = false` so the consumer can render them as empty space —
 * producing the "chipped" corners.
 */
export function buildGrid(period: HeatmapPeriodInfo): HeatmapGrid {
  const start = parseIsoDate(period.start);
  const end = parseIsoDate(period.end);

  // Sunday before or on start
  const gridStart = addUtcDays(start, -start.getUTCDay());
  // Saturday after or on end
  const gridEnd = addUtcDays(end, 6 - end.getUTCDay());
  const totalDays = diffInDays(gridStart, gridEnd) + 1;
  const weekCount = totalDays / 7;

  const rows: HeatmapGridCell[][] = Array.from({ length: 7 }, () => []);
  const monthLabels: string[] = Array.from({ length: weekCount }, () => '');

  let lastMonthLabeled = -1;
  for (let week = 0; week < weekCount; week++) {
    for (let day = 0; day < 7; day++) {
      const cellDate = addUtcDays(gridStart, week * 7 + day);
      const inPeriod = cellDate >= start && cellDate <= end;
      rows[day]!.push({
        date: inPeriod ? toIsoDate(cellDate) : null,
        inPeriod,
      });
    }

    // The month label belongs to the column based on the first in-period
    // cell — that way a partial leading week (e.g., Sun Dec 31 → Sat Jan 6
    // for year 2024) is labeled "Jan", not "Dec".
    let columnMonthIndex: number | null = null;
    for (let day = 0; day < 7; day++) {
      const cell = rows[day]![week]!;
      if (cell.inPeriod && cell.date) {
        columnMonthIndex = Number.parseInt(cell.date.slice(5, 7), 10) - 1;
        break;
      }
    }
    if (columnMonthIndex !== null && columnMonthIndex !== lastMonthLabeled) {
      monthLabels[week] = MONTH_NAMES[columnMonthIndex] ?? '';
      lastMonthLabeled = columnMonthIndex;
    }
  }

  return { weekCount, rows, monthLabels };
}

/**
 * Compute the violet intensity bucket (0-4) for a given job count.
 * 0 means "no activity"; 4 means "max activity in the period".
 * Buckets split [1, max] into 4 equal-width ranges, matching GitHub's
 * threshold scheme.
 */
export function getIntensityBucket(jobCount: number, maxJobCount: number): 0 | 1 | 2 | 3 | 4 {
  if (jobCount <= 0 || maxJobCount <= 0) return 0;
  const ratio = jobCount / maxJobCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Format an ISO date (YYYY-MM-DD) to a human-readable date in UTC.
 * Example: "2024-04-17" -> "Wed, Apr 17, 2024".
 */
export function formatHeatmapDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseIsoDate(isoDate));
}

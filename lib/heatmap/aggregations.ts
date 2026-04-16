/**
 * Pure heatmap aggregation helpers.
 *
 * All functions here are deterministic and side-effect free so they
 * can be unit-tested with Vitest without any Prisma or HTTP fixtures.
 */

import type {
  HeatmapIntensityThresholds,
  HeatmapPeriod,
  HeatmapPeriodOption,
  HeatmapTotals,
} from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface HeatmapPeriodBounds {
  /** Inclusive period start (midnight local) */
  startDate: Date;
  /** Inclusive period end (end-of-day local) */
  endDate: Date;
  /** Sunday on/before startDate (midnight local) */
  gridStart: Date;
  /** Saturday on/after endDate (end-of-day local) */
  gridEnd: Date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function sundayOnOrBefore(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function saturdayOnOrAfter(date: Date): Date {
  const d = startOfDay(date);
  const diff = 6 - d.getDay();
  d.setDate(d.getDate() + diff);
  return endOfDay(d);
}

function isYearPeriod(period: HeatmapPeriod): period is `${number}` {
  return /^\d{4}$/.test(period);
}

/**
 * Resolve period bounds for the selected period.
 * For `last-12-months`, range is `[now - 365 days, now]`.
 * For a year, range is `[YYYY-01-01, YYYY-12-31]`.
 * Grid window extends to the enclosing Sunday..Saturday.
 */
export function getPeriodBounds(
  period: HeatmapPeriod,
  _userCreatedAt: Date,
  now: Date
): HeatmapPeriodBounds {
  let startDate: Date;
  let endDate: Date;

  if (isYearPeriod(period)) {
    const year = Number(period);
    startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  } else {
    endDate = endOfDay(now);
    const start = startOfDay(now);
    start.setDate(start.getDate() - 365);
    startDate = start;
  }

  return {
    startDate,
    endDate,
    gridStart: sundayOnOrBefore(startDate),
    gridEnd: saturdayOnOrAfter(endDate),
  };
}

/**
 * Build the period selector options: "Last 12 months" always first,
 * plus one entry per calendar year from `createdAt.getFullYear()`
 * to `now.getFullYear()` in descending order. Returns only the default
 * option when the user was created in the current year.
 */
export function buildPeriodOptions(userCreatedAt: Date, now: Date): HeatmapPeriodOption[] {
  const defaultOption: HeatmapPeriodOption = {
    value: 'last-12-months',
    label: 'Last 12 months',
    isDefault: true,
  };

  const currentYear = now.getFullYear();
  const createdYear = userCreatedAt.getFullYear();

  if (createdYear >= currentYear) {
    return [defaultOption];
  }

  const yearOptions: HeatmapPeriodOption[] = [];
  for (let year = currentYear; year >= createdYear; year -= 1) {
    yearOptions.push({
      value: String(year) as `${number}`,
      label: String(year),
      isDefault: false,
    });
  }

  return [defaultOption, ...yearOptions];
}

/**
 * Compute quartile upper-bound thresholds from a list of non-zero daily job
 * counts. Returns `[Q1, Q2, Q3, max]` used for bucketing into levels 1-4.
 * For an empty input (no activity), returns `[0, 0, 0, 0]` which forces
 * every day to level 0.
 */
export function computeIntensityThresholds(
  nonZeroDailyCounts: readonly number[]
): HeatmapIntensityThresholds {
  if (nonZeroDailyCounts.length === 0) {
    return [0, 0, 0, 0];
  }

  const sorted = [...nonZeroDailyCounts].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1] ?? 0;

  const quantile = (fraction: number): number => {
    const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
    return sorted[Math.max(0, idx)] ?? 0;
  };

  const q1 = quantile(0.25);
  const q2 = quantile(0.5);
  const q3 = quantile(0.75);

  return [q1, q2, q3, max];
}

/**
 * Map a daily job count to an intensity level 0-4 using the supplied
 * thresholds. Boundaries are inclusive on the upper side for levels 1-3.
 */
export function getIntensityLevel(
  count: number,
  thresholds: HeatmapIntensityThresholds
): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  const [q1, q2, q3] = thresholds;
  if (count <= q1) return 1;
  if (count <= q2) return 2;
  if (count <= q3) return 3;
  return 4;
}

/**
 * Literal Tailwind classes per intensity level. Returned strings are
 * complete so Tailwind's JIT purger can detect them.
 */
export function getIntensityClass(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 0:
      return 'bg-muted/30';
    case 1:
      return 'bg-violet-500/20';
    case 2:
      return 'bg-violet-500/40';
    case 3:
      return 'bg-violet-500/70';
    case 4:
      return 'bg-violet-500';
  }
}

/**
 * Build the summary copy shown above the grid, e.g.
 * `"12 jobs · 3 tickets shipped in the last year"`.
 */
export function formatHeaderCopy(period: HeatmapPeriod, totals: HeatmapTotals): string {
  const jobsText = `${totals.jobCount} ${totals.jobCount === 1 ? 'job' : 'jobs'}`;
  const shippedText = `${totals.shippedTicketCount} ${
    totals.shippedTicketCount === 1 ? 'ticket shipped' : 'tickets shipped'
  }`;
  const suffix = isYearPeriod(period) ? `in ${period}` : 'in the last year';
  return `${jobsText} · ${shippedText} ${suffix}`;
}

/**
 * Format a Date as `YYYY-MM-DD` in the server's local timezone.
 * Used for bucketing jobs by date and rendering cell keys.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Iterate through all days from `gridStart` to `gridEnd` (inclusive) and
 * return `YYYY-MM-DD` keys in order. Used when building the contiguous
 * `days[]` array in the API payload.
 */
export function enumerateDateKeys(gridStart: Date, gridEnd: Date): string[] {
  const keys: string[] = [];
  const cursor = startOfDay(gridStart);
  const end = startOfDay(gridEnd);
  while (cursor.getTime() <= end.getTime()) {
    keys.push(formatDateKey(cursor));
    cursor.setTime(cursor.getTime() + MS_PER_DAY);
    // Protect against DST drift by renormalising to midnight local time.
    cursor.setHours(0, 0, 0, 0);
  }
  return keys;
}

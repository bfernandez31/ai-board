import {
  HEATMAP_AGENT_FILTER_VALUES,
  HEATMAP_PERIOD_ROLLING,
  type HeatmapAgentFilter,
  type HeatmapFilters,
  type HeatmapPeriod,
  type HeatmapPeriodOption,
} from './types';

export const DEFAULT_HEATMAP_FILTERS: HeatmapFilters = {
  period: HEATMAP_PERIOD_ROLLING,
  agent: 'all',
};

export const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidHeatmapAgent(value: string): value is HeatmapAgentFilter {
  return (HEATMAP_AGENT_FILTER_VALUES as readonly string[]).includes(value);
}

export function isValidCalendarYear(value: string, now: Date = new Date()): boolean {
  if (!/^\d{4}$/.test(value)) return false;
  const year = Number(value);
  return year >= 1970 && year <= now.getUTCFullYear() + 1;
}

export function isValidHeatmapPeriod(value: string, now: Date = new Date()): value is HeatmapPeriod {
  return value === HEATMAP_PERIOD_ROLLING || isValidCalendarYear(value, now);
}

/**
 * Returns period bounds (UTC, inclusive ISO date strings YYYY-MM-DD).
 * "last-12-months": [today - 364 days, today] — 365-day rolling window.
 * "YYYY": [YYYY-01-01, YYYY-12-31] clamped to today if YYYY is the current year.
 */
export function getPeriodBounds(
  period: HeatmapPeriod,
  now: Date = new Date()
): { start: Date; end: Date } {
  const today = startOfUTCDay(now);

  if (period === HEATMAP_PERIOD_ROLLING) {
    const start = new Date(today.getTime() - 364 * DAY_MS);
    return { start, end: today };
  }

  const year = Number(period);
  const start = new Date(Date.UTC(year, 0, 1));
  const lastDayOfYear = new Date(Date.UTC(year, 11, 31));
  const end = lastDayOfYear.getTime() > today.getTime() ? today : lastDayOfYear;
  return { start, end };
}

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Generate the list of available period options. Always includes "Last 12 months"
 * plus every calendar year from the user's account creation year through the
 * current year (descending).
 */
export function buildPeriodOptions(
  accountCreatedAt: Date,
  now: Date = new Date()
): HeatmapPeriodOption[] {
  const options: HeatmapPeriodOption[] = [
    { value: HEATMAP_PERIOD_ROLLING, label: 'Last 12 months' },
  ];
  const currentYear = now.getUTCFullYear();
  const firstYear = Math.min(accountCreatedAt.getUTCFullYear(), currentYear);

  // Only add calendar-year options when the account has history before this year.
  if (firstYear < currentYear) {
    for (let year = currentYear; year >= firstYear; year--) {
      options.push({ value: String(year) as HeatmapPeriod, label: String(year) });
    }
  }
  return options;
}

/**
 * GitHub-style intensity bucket (0-4) based on the full period's max count.
 * 0 = no activity; 1-4 = quartile ramp.
 */
export function intensityLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (max <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Maps the 0-4 intensity to an aurora-themed Tailwind utility class.
 * Returning static strings ensures Tailwind's purger keeps them.
 */
export function intensityClass(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 0:
      return 'bg-muted/40 border border-border/40';
    case 1:
      return 'bg-violet-500/20 border border-violet-500/20';
    case 2:
      return 'bg-violet-500/40 border border-violet-500/30';
    case 3:
      return 'bg-violet-500/60 border border-violet-500/40';
    case 4:
      return 'bg-violet-500/90 border border-violet-400/60 shadow-[0_0_6px_hsl(var(--ctp-mauve)/0.35)]';
  }
}

/**
 * Build a dense list of dates from start..end (inclusive) in UTC, with zero-filled counts.
 */
export function fillDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    dates.push(toISODate(new Date(t)));
  }
  return dates;
}

export interface HeatmapColumn {
  /** Each slot is either an ISO date or null (chipped corner). */
  days: Array<string | null>;
  /** 0-indexed month of the first real date in this column, or null. */
  month: number | null;
  /** Year of the first real date in this column, or null. */
  year: number | null;
}

/**
 * Group days into columns-of-7 keyed on day-of-week (0=Sunday..6=Saturday).
 * Cells outside the period are rendered as null (chipped corners).
 */
export function buildWeeks(dates: string[]): HeatmapColumn[] {
  if (dates.length === 0) return [];

  const firstDate = new Date(`${dates[0]}T00:00:00Z`);
  const lastDate = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
  const leadingNulls = firstDate.getUTCDay();
  const trailingNulls = 6 - lastDate.getUTCDay();

  const padded: Array<string | null> = [
    ...Array<null>(leadingNulls).fill(null),
    ...dates,
    ...Array<null>(trailingNulls).fill(null),
  ];

  const columns: HeatmapColumn[] = [];
  for (let i = 0; i < padded.length; i += 7) {
    const slots = padded.slice(i, i + 7);
    const firstReal = slots.find((slot): slot is string => slot !== null);
    if (firstReal) {
      const d = new Date(`${firstReal}T00:00:00Z`);
      columns.push({ days: slots, month: d.getUTCMonth(), year: d.getUTCFullYear() });
    } else {
      columns.push({ days: slots, month: null, year: null });
    }
  }
  return columns;
}

/**
 * Pick where to render the month label above each column. We label the column
 * when its first real row is in a new month and that month occupies at least
 * ~2 rows (otherwise GitHub stacks labels). Returns a parallel array of
 * labels (empty string = no label).
 */
export function monthLabels(columns: HeatmapColumn[]): string[] {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastMonth: number | null = null;
  return columns.map((column) => {
    if (column.month === null) return '';
    if (column.month === lastMonth) return '';
    lastMonth = column.month;
    return MONTHS[column.month] ?? '';
  });
}

/**
 * Format an ISO date as e.g. "Mon, Apr 8, 2026" for tooltip display.
 */
export function formatTooltipDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Format USD cost without rounding tiny non-zero values down to $0.00. Any
 * positive amount under $0.01 is displayed as "<$0.01" — matching the
 * requirement that we never show misleading "$0" for real data.
 */
export function formatCost(cost: number): string {
  if (cost >= 0.01 || cost <= -0.01) {
    return `$${cost.toFixed(2)}`;
  }
  if (cost > 0) return '<$0.01';
  return '$0.00';
}

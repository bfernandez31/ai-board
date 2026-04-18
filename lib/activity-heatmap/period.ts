import {
  HEATMAP_ROLLING_PERIOD,
  type HeatmapPeriod,
  type HeatmapPeriodOption,
  type HeatmapPeriodRange,
} from './types';

/**
 * Format a Date as YYYY-MM-DD using UTC components so the heatmap uses a
 * stable, timezone-independent day bucket.
 */
export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((part) => parseInt(part, 10));
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function isValidYear(value: string): boolean {
  return /^\d{4}$/.test(value);
}

export function normalizePeriodValue(value: string | null | undefined): HeatmapPeriod {
  if (!value) return HEATMAP_ROLLING_PERIOD;
  if (value === HEATMAP_ROLLING_PERIOD) return HEATMAP_ROLLING_PERIOD;
  if (isValidYear(value)) return value;
  return HEATMAP_ROLLING_PERIOD;
}

/**
 * Resolve a period value into a concrete inclusive date range.
 *
 * - `last-12m`: rolling 365-day window ending today (UTC).
 * - `YYYY`: January 1 to December 31 of that year (clamped to today for the current year).
 */
export function resolvePeriodRange(
  period: HeatmapPeriod,
  now: Date = new Date()
): HeatmapPeriodRange {
  const today = startOfUtcDay(now);

  if (period === HEATMAP_ROLLING_PERIOD) {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 364);
    return {
      startDate: toIsoDate(start),
      endDate: toIsoDate(today),
      value: HEATMAP_ROLLING_PERIOD,
      label: 'Last 12 months',
    };
  }

  const year = parseInt(period, 10);
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const clampedEnd = end.getTime() > today.getTime() ? today : end;
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(clampedEnd),
    value: period,
    label: String(year),
  };
}

/**
 * Build the dropdown options for the period selector.
 * Always includes the rolling 12-month option first; then every calendar year
 * from the user's account creation year up to the current year.
 */
export function buildPeriodOptions(
  userCreatedAt: Date,
  now: Date = new Date()
): HeatmapPeriodOption[] {
  const currentYear = now.getUTCFullYear();
  const createdYear = userCreatedAt.getUTCFullYear();
  const options: HeatmapPeriodOption[] = [
    { value: HEATMAP_ROLLING_PERIOD, label: 'Last 12 months' },
  ];
  if (createdYear < currentYear) {
    for (let year = currentYear; year >= createdYear; year--) {
      options.push({ value: String(year), label: String(year) });
    }
  }
  return options;
}

/**
 * Enumerate every day (YYYY-MM-DD) in the inclusive [startDate, endDate] range.
 */
export function enumerateDays(startIso: string, endIso: string): string[] {
  const result: string[] = [];
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    result.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

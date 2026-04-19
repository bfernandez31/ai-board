import type { HeatmapAgentFilter, HeatmapPeriod } from './types';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';

export const DEFAULT_HEATMAP_FILTERS = {
  period: 'last12' as const,
  agent: 'all' as const,
};

/** Serialize a Date to YYYY-MM-DD in UTC. */
export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parse YYYY-MM-DD as a UTC Date at midnight. Returns null on invalid input. */
export function parseUtcDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Add (or subtract) whole days from a UTC midnight date. */
export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export interface PeriodBounds {
  /** Inclusive start (UTC midnight). */
  start: Date;
  /** Inclusive end (UTC midnight). */
  end: Date;
}

/**
 * Compute the UTC bounds for a heatmap period.
 * - 'last12': rolling 12 months ending today (today - 364 days → today).
 * - number: full calendar year, clamped on the upper end to today if year === current year.
 */
export function getPeriodBounds(period: HeatmapPeriod, now: Date): PeriodBounds {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (period === 'last12') {
    const start = addUtcDays(today, -364);
    return { start, end: today };
  }

  const year = period;
  const start = new Date(Date.UTC(year, 0, 1));
  const lastDayOfYear = new Date(Date.UTC(year, 11, 31));
  const end = lastDayOfYear.getTime() > today.getTime() ? today : lastDayOfYear;
  return { start, end };
}

/**
 * Years from account creation year to current year (inclusive), in descending order.
 * Returns an empty array when the account was created in the current year (only
 * "Last 12 months" applies).
 */
export function buildAvailableYears(createdAt: Date, now: Date): number[] {
  const currentYear = now.getUTCFullYear();
  const createdYear = createdAt.getUTCFullYear();
  if (createdYear >= currentYear) return [];

  const years: number[] = [];
  for (let y = currentYear; y >= createdYear; y -= 1) {
    years.push(y);
  }
  return years;
}

export function isValidAgentFilter(value: string | null): value is HeatmapAgentFilter {
  if (!value) return false;
  if (value === 'all') return true;
  return (ALL_AGENTS as readonly string[]).includes(value);
}

export function parsePeriodFilter(value: string | null): HeatmapPeriod | null {
  if (!value || value === 'last12') return 'last12';
  if (/^\d{4}$/.test(value)) {
    const year = Number(value);
    if (year >= 1970 && year <= 9999) return year;
  }
  return null;
}

import type { HeatmapDay, HeatmapPeriod } from './types';

export const DEFAULT_HEATMAP_PERIOD: HeatmapPeriod = 'last-12-months';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function formatIsoDate(date: Date): string {
  const iso = date.toISOString();
  return iso.slice(0, 10);
}

export function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function isValidPeriod(value: string): value is HeatmapPeriod {
  if (value === 'last-12-months') return true;
  const match = /^year-(\d{4})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  return Number.isFinite(year) && year >= 1970 && year <= 9999;
}

export function getYearFromPeriod(period: HeatmapPeriod): number | null {
  if (period === 'last-12-months') return null;
  const match = /^year-(\d{4})$/.exec(period);
  return match ? Number(match[1]) : null;
}

export function getPeriodLabel(period: HeatmapPeriod): string {
  if (period === 'last-12-months') return 'Last 12 months';
  const year = getYearFromPeriod(period);
  return year !== null ? String(year) : period;
}

export interface PeriodBoundaries {
  startDate: Date;
  endDate: Date;
}

export function getPeriodBoundaries(
  period: HeatmapPeriod,
  now: Date = new Date()
): PeriodBoundaries {
  const today = toUtcDateOnly(now);
  const year = getYearFromPeriod(period);

  if (year !== null) {
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31));
    return { startDate, endDate };
  }

  const endDate = today;
  const startDate = addDays(endDate, -364);
  return { startDate, endDate };
}

export function getAvailablePeriods(
  userCreatedAt: Date,
  now: Date = new Date()
): HeatmapPeriod[] {
  const periods: HeatmapPeriod[] = ['last-12-months'];
  const currentYear = now.getUTCFullYear();
  const createdYear = userCreatedAt.getUTCFullYear();

  for (let year = currentYear; year >= createdYear; year--) {
    periods.push(`year-${year}` as HeatmapPeriod);
  }

  return periods;
}

export function shouldShowYearSelector(
  userCreatedAt: Date,
  now: Date = new Date()
): boolean {
  return now.getUTCFullYear() > userCreatedAt.getUTCFullYear();
}

export interface HeatmapGridCell {
  date: string;
  dayOfWeek: number;
  weekIndex: number;
  day: HeatmapDay;
}

export interface HeatmapGrid {
  weeks: Array<Array<HeatmapGridCell | null>>;
  monthLabels: Array<{ weekIndex: number; month: string }>;
}

export function buildHeatmapGrid(
  days: HeatmapDay[],
  startDate: Date,
  endDate: Date
): HeatmapGrid {
  const dayMap = new Map<string, HeatmapDay>();
  for (const day of days) {
    dayMap.set(day.date, day);
  }

  const weeks: Array<Array<HeatmapGridCell | null>> = [];
  const monthLabels: Array<{ weekIndex: number; month: string }> = [];

  // GitHub-style: weeks start on Sunday (day 0)
  const firstDayOfWeek = startDate.getUTCDay();
  let cursor = addDays(startDate, -firstDayOfWeek);

  let weekIndex = 0;
  let lastMonth = -1;

  while (cursor <= endDate) {
    const week: Array<HeatmapGridCell | null> = [];
    let firstRenderedDayOfWeek = -1;

    for (let dow = 0; dow < 7; dow++) {
      if (cursor < startDate || cursor > endDate) {
        week.push(null);
      } else {
        const dateStr = formatIsoDate(cursor);
        const day =
          dayMap.get(dateStr) ?? {
            date: dateStr,
            jobCount: 0,
            totalCost: 0,
            hasCost: false,
            ticketsShipped: 0,
          };
        week.push({ date: dateStr, dayOfWeek: dow, weekIndex, day });
        if (firstRenderedDayOfWeek === -1) {
          firstRenderedDayOfWeek = dow;
          const month = cursor.getUTCMonth();
          if (month !== lastMonth && cursor.getUTCDate() <= 7) {
            const monthName = cursor.toLocaleDateString('en-US', {
              month: 'short',
              timeZone: 'UTC',
            });
            monthLabels.push({ weekIndex, month: monthName });
            lastMonth = month;
          }
        }
      }
      cursor = addDays(cursor, 1);
    }

    weeks.push(week);
    weekIndex++;
  }

  return { weeks, monthLabels };
}

export function getIntensityLevel(
  jobCount: number,
  maxJobCount: number
): 0 | 1 | 2 | 3 | 4 {
  if (jobCount <= 0) return 0;
  if (maxJobCount <= 0) return 0;
  const ratio = jobCount / maxJobCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function getMaxJobCount(days: HeatmapDay[]): number {
  let max = 0;
  for (const day of days) {
    if (day.jobCount > max) max = day.jobCount;
  }
  return max;
}

export function formatTooltipDate(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

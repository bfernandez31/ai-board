/**
 * Heatmap period helpers (pure functions, no Prisma or React imports).
 *
 * Decision 8 (research.md): selector shows "Last 12 months" + each calendar
 * year from the user's join year through today, reverse-chronological.
 * Decision 12: endDate is clamped to now.
 */

import type {
  HeatmapPeriodBoundaries,
  HeatmapPeriodKey,
  HeatmapPeriodParam,
} from './types';

const DEFAULT_PERIOD: HeatmapPeriodKey = { kind: 'rolling', months: 12 };

export function serializePeriodParam(period: HeatmapPeriodKey): HeatmapPeriodParam {
  if (period.kind === 'rolling') return '12m';
  return `${period.year}`;
}

export function parsePeriodParam(
  raw: string | null | undefined,
  joinYear: number,
  now: Date = new Date()
): HeatmapPeriodKey {
  if (!raw) return { ...DEFAULT_PERIOD };
  const trimmed = raw.trim();
  if (trimmed === '12m') return { kind: 'rolling', months: 12 };

  if (/^\d{4}$/.test(trimmed)) {
    const year = Number(trimmed);
    const currentYear = now.getUTCFullYear();
    if (year >= joinYear && year <= currentYear) {
      return { kind: 'year', year };
    }
  }

  return { ...DEFAULT_PERIOD };
}

export function resolvePeriod(
  period: HeatmapPeriodKey,
  joinYear: number,
  now: Date = new Date()
): HeatmapPeriodKey {
  if (period.kind === 'rolling') return { kind: 'rolling', months: 12 };
  const currentYear = now.getUTCFullYear();
  if (period.year < joinYear || period.year > currentYear) {
    return { ...DEFAULT_PERIOD };
  }
  return { kind: 'year', year: period.year };
}

export function getPeriodBoundaries(
  period: HeatmapPeriodKey,
  now: Date = new Date()
): HeatmapPeriodBoundaries {
  const clampedNow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );

  if (period.kind === 'rolling') {
    const start = new Date(
      Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
    );
    return {
      startDate: start,
      endDate: clampedNow,
      label: 'the last year',
    };
  }

  const { year } = period;
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const endDate = yearEnd.getTime() > clampedNow.getTime() ? clampedNow : yearEnd;
  return {
    startDate: yearStart,
    endDate,
    label: `${year}`,
  };
}

export function enumerateYearsSinceJoin(joinYear: number, now: Date = new Date()): number[] {
  const currentYear = now.getUTCFullYear();
  if (joinYear > currentYear) return [];
  if (joinYear === currentYear) return [];
  const years: number[] = [];
  for (let y = currentYear; y >= joinYear; y -= 1) {
    years.push(y);
  }
  return years;
}

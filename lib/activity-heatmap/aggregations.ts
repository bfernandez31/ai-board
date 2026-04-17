import type { HeatmapDay, HeatmapPeriod, HeatmapPeriodOption } from './types';

export interface ResolvedPeriod {
  start: Date;
  end: Date;
  label: string;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isValidPeriod(period: string): boolean {
  return period === 'last-12-months' || /^\d{4}$/.test(period);
}

export function resolvePeriod(period: HeatmapPeriod, now: Date = new Date()): ResolvedPeriod {
  if (period === 'last-12-months' || !/^\d{4}$/.test(period)) {
    const end = endOfDay(now);
    const startRef = new Date(now);
    startRef.setFullYear(startRef.getFullYear() - 1);
    startRef.setDate(startRef.getDate() + 1);
    return {
      start: startOfDay(startRef),
      end,
      label: 'Last 12 months',
    };
  }

  const year = parseInt(period, 10);
  return {
    start: new Date(year, 0, 1, 0, 0, 0, 0),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
    label: String(year),
  };
}

export function buildAvailablePeriods(
  userCreatedAt: Date,
  now: Date = new Date()
): HeatmapPeriodOption[] {
  const options: HeatmapPeriodOption[] = [
    { value: 'last-12-months', label: 'Last 12 months' },
  ];

  const currentYear = now.getFullYear();
  const startYear = userCreatedAt.getFullYear();

  if (startYear >= currentYear) {
    return options;
  }

  for (let year = currentYear; year >= startYear; year--) {
    options.push({ value: String(year), label: String(year) });
  }

  return options;
}

export interface HeatmapGridCell {
  /** YYYY-MM-DD */
  date: string;
  /** 0 (Sun) – 6 (Sat) */
  dayOfWeek: number;
  /** Column index in the grid (0-based) */
  weekIndex: number;
  /** True when this date falls within the requested period; false for chipped corners */
  inPeriod: boolean;
  /** Aggregated activity for this day (undefined when no jobs or outside period) */
  data: HeatmapDay | undefined;
}

export interface HeatmapGrid {
  /** 7 rows (Sunday–Saturday) each holding one cell per week column */
  rows: HeatmapGridCell[][];
  /** Month labels aligned to each week column; null when no new month started that column */
  monthLabels: Array<{ weekIndex: number; label: string }>;
  /** Total number of week columns in the grid */
  weekCount: number;
}

const MONTH_NAMES = [
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

export function buildHeatmapGrid(
  periodStart: Date,
  periodEnd: Date,
  days: HeatmapDay[]
): HeatmapGrid {
  const dayMap = new Map<string, HeatmapDay>();
  for (const day of days) dayMap.set(day.date, day);

  const gridStart = startOfDay(periodStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = startOfDay(periodEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const rows: HeatmapGridCell[][] = [[], [], [], [], [], [], []];
  const monthLabels: Array<{ weekIndex: number; label: string }> = [];

  let weekIndex = 0;
  let lastLabeledMonth = -1;
  const current = new Date(gridStart);
  const periodStartTime = startOfDay(periodStart).getTime();
  const periodEndTime = endOfDay(periodEnd).getTime();

  while (current.getTime() <= gridEnd.getTime()) {
    const dow = current.getDay();
    const iso = formatISODate(current);
    const ts = current.getTime();
    const inPeriod = ts >= periodStartTime && ts <= periodEndTime;

    rows[dow]!.push({
      date: iso,
      dayOfWeek: dow,
      weekIndex,
      inPeriod,
      data: inPeriod ? dayMap.get(iso) : undefined,
    });

    if (dow === 0) {
      const month = current.getMonth();
      if (month !== lastLabeledMonth) {
        monthLabels.push({ weekIndex, label: MONTH_NAMES[month]! });
        lastLabeledMonth = month;
      }
    }

    if (dow === 6) weekIndex += 1;
    current.setDate(current.getDate() + 1);
  }

  return {
    rows,
    monthLabels,
    weekCount: weekIndex,
  };
}

export interface IntensityThresholds {
  /** Upper bound (inclusive) for level 1. Cells with count <= this → level 1. */
  level1: number;
  level2: number;
  level3: number;
  level4: number;
}

/**
 * Compute quartile thresholds for non-zero job counts. Cells at 0 get level 0;
 * above level4 threshold is still level 4.
 */
export function computeIntensityThresholds(days: HeatmapDay[]): IntensityThresholds {
  const counts = days.map((d) => d.jobCount).filter((c) => c > 0);
  if (counts.length === 0) {
    return { level1: 1, level2: 2, level3: 3, level4: 4 };
  }

  const max = Math.max(...counts);
  if (max <= 4) {
    return {
      level1: 1,
      level2: 2,
      level3: 3,
      level4: Math.max(4, max),
    };
  }

  return {
    level1: Math.max(1, Math.ceil(max * 0.25)),
    level2: Math.max(2, Math.ceil(max * 0.5)),
    level3: Math.max(3, Math.ceil(max * 0.75)),
    level4: max,
  };
}

export type IntensityLevel = 0 | 1 | 2 | 3 | 4;

export function getIntensityLevel(
  count: number,
  thresholds: IntensityThresholds
): IntensityLevel {
  if (count <= 0) return 0;
  if (count <= thresholds.level1) return 1;
  if (count <= thresholds.level2) return 2;
  if (count <= thresholds.level3) return 3;
  return 4;
}

export function getIntensityClass(level: IntensityLevel): string {
  switch (level) {
    case 0:
      return 'aurora-heatmap-cell-0';
    case 1:
      return 'aurora-heatmap-cell-1';
    case 2:
      return 'aurora-heatmap-cell-2';
    case 3:
      return 'aurora-heatmap-cell-3';
    case 4:
      return 'aurora-heatmap-cell-4';
  }
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((part) => parseInt(part, 10));
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

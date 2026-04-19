import { addUtcDays, formatUtcDate, parseUtcDate } from './aggregations';
import type { HeatmapDay } from './types';

export interface GridCell {
  /** YYYY-MM-DD, or null for cells outside the selected period (chipped corners). */
  date: string | null;
  /** Activity bucket 0-4 (0 = no activity, 4 = highest). Null when the cell is empty. */
  level: number | null;
  day: HeatmapDay | null;
}

export interface GridColumn {
  /** Seven cells, top-to-bottom Sun → Sat. */
  cells: GridCell[];
  /** Month label to display at the top of this column, or null. */
  monthLabel: string | null;
  /** Unique key for the column based on the first date encountered. */
  key: string;
}

export interface GridLayout {
  columns: GridColumn[];
  /** Highest bucket used for legend rendering. Always 0-4. */
  maxLevel: number;
}

const DAYS_IN_WEEK = 7;

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/**
 * Build the heatmap layout from an ISO date range and daily data.
 *
 * Grid convention: columns are weeks left-to-right; rows are Sun..Sat top-to-bottom.
 * Cells before `startDate` in the first column and cells after `endDate` in the
 * last column are rendered as null (GitHub-style chipped corners).
 */
export function buildGridLayout(
  startDate: string,
  endDate: string,
  days: HeatmapDay[]
): GridLayout {
  const start = parseUtcDate(startDate);
  const end = parseUtcDate(endDate);
  if (!start || !end || start > end) {
    return { columns: [], maxLevel: 0 };
  }

  const daysByDate = new Map<string, HeatmapDay>();
  let maxCount = 0;
  for (const day of days) {
    daysByDate.set(day.date, day);
    if (day.jobCount > maxCount) maxCount = day.jobCount;
  }

  const firstSunday = addUtcDays(start, -start.getUTCDay());
  const lastSaturday = addUtcDays(end, 6 - end.getUTCDay());
  const totalDays = Math.round((lastSaturday.getTime() - firstSunday.getTime()) / 86_400_000) + 1;
  const numCols = Math.round(totalDays / DAYS_IN_WEEK);

  const columns: GridColumn[] = [];
  let previousMonth = -1;

  for (let c = 0; c < numCols; c += 1) {
    const columnStart = addUtcDays(firstSunday, c * DAYS_IN_WEEK);
    const cells: GridCell[] = [];
    let firstInBoundsDate: Date | null = null;

    for (let r = 0; r < DAYS_IN_WEEK; r += 1) {
      const cellDate = addUtcDays(columnStart, r);
      const inRange = cellDate >= start && cellDate <= end;
      if (!inRange) {
        cells.push({ date: null, level: null, day: null });
        continue;
      }

      if (!firstInBoundsDate) firstInBoundsDate = cellDate;
      const iso = formatUtcDate(cellDate);
      const day = daysByDate.get(iso) ?? null;
      const level = computeLevel(day?.jobCount ?? 0, maxCount);
      cells.push({
        date: iso,
        level,
        day,
      });
    }

    // Use the first in-range date's month for the header label. Skip the
    // label when the column has no in-range cells yet (should be rare).
    let monthLabel: string | null = null;
    if (firstInBoundsDate) {
      const month = firstInBoundsDate.getUTCMonth();
      if (month !== previousMonth) {
        monthLabel = MONTH_LABELS[month] ?? null;
        previousMonth = month;
      }
    }

    columns.push({
      key: formatUtcDate(columnStart),
      cells,
      monthLabel,
    });
  }

  const maxLevel = computeLevel(maxCount, maxCount);
  return { columns, maxLevel };
}

/**
 * Quartile-based bucketing over the observed max count. Zero always maps to 0.
 */
export function computeLevel(count: number, max: number): number {
  if (count <= 0) return 0;
  if (max <= 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function formatTooltipDate(dateIso: string): string {
  const date = parseUtcDate(dateIso);
  if (!date) return dateIso;
  return date.toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

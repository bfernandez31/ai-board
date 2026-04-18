import { parseIsoDate, toIsoDate } from './period';
import type { HeatmapDay } from './types';

export interface HeatmapCell {
  /** ISO date — null when this slot is outside the period (chipped corner) */
  date: string | null;
  day: HeatmapDay | null;
  /** 0 (Sunday) through 6 (Saturday) */
  weekday: number;
}

export interface HeatmapWeek {
  /** Column index (0-based) */
  index: number;
  /** ISO date of Sunday anchoring this week (always populated, even if chipped) */
  startIso: string;
  cells: HeatmapCell[];
}

export interface HeatmapMonthLabel {
  /** Zero-based column index where the label starts */
  weekIndex: number;
  /** 3-letter month name (Jan, Feb, ...) */
  label: string;
}

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Compute the Sunday on or before the given UTC date.
 */
function sundayOfWeek(iso: string): Date {
  const d = parseIsoDate(iso);
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - dayOfWeek);
  return d;
}

/**
 * Build the GitHub-style week-column grid for the given [startIso, endIso] range.
 *
 * Cells outside the range are returned with `date: null` so the caller can
 * render a "chipped" corner (no background) matching GitHub's behavior when
 * the period doesn't start on Sunday or end on Saturday.
 */
export function buildHeatmapGrid(
  startIso: string,
  endIso: string,
  days: HeatmapDay[]
): HeatmapWeek[] {
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const weeks: HeatmapWeek[] = [];

  const gridStart = sundayOfWeek(startIso);
  const endDate = parseIsoDate(endIso);

  const cursor = new Date(gridStart);
  let weekIndex = 0;

  while (cursor.getTime() <= endDate.getTime()) {
    const weekStartIso = toIsoDate(cursor);
    const cells: HeatmapCell[] = [];
    for (let i = 0; i < 7; i++) {
      const cellDate = new Date(cursor);
      cellDate.setUTCDate(cellDate.getUTCDate() + i);
      const iso = toIsoDate(cellDate);
      const inRange = iso >= startIso && iso <= endIso;
      cells.push({
        date: inRange ? iso : null,
        day: inRange ? dayMap.get(iso) ?? null : null,
        weekday: i,
      });
    }
    weeks.push({ index: weekIndex, startIso: weekStartIso, cells });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    weekIndex += 1;
  }

  return weeks;
}

/**
 * Compute the month labels positioned above each week column.
 * A label is placed on the first week whose first in-range day lands in a
 * previously-unlabeled month.
 */
export function buildMonthLabels(weeks: HeatmapWeek[]): HeatmapMonthLabel[] {
  const labels: HeatmapMonthLabel[] = [];
  let lastMonth = -1;
  for (const week of weeks) {
    for (const cell of week.cells) {
      if (!cell.date) continue;
      const date = parseIsoDate(cell.date);
      const month = date.getUTCMonth();
      if (month !== lastMonth) {
        labels.push({
          weekIndex: week.index,
          label: MONTH_NAMES_SHORT[month]!,
        });
        lastMonth = month;
      }
      break; // one label per week max
    }
  }
  return labels;
}

/**
 * Map a job count to a discrete intensity level 0-4.
 * Fixed thresholds avoid the jitter of computing quantiles per render while
 * still distinguishing low / moderate / high activity days.
 */
export function getIntensityLevel(jobCount: number): 0 | 1 | 2 | 3 | 4 {
  if (jobCount <= 0) return 0;
  if (jobCount <= 2) return 1;
  if (jobCount <= 5) return 2;
  if (jobCount <= 9) return 3;
  return 4;
}

/**
 * Pure layout helpers for the activity heatmap grid.
 *
 * The grid is laid out in column-major order (weeks on x-axis, days on y-axis).
 * Each column represents an ISO calendar week (Sun → Sat). Days outside the
 * selected period are NOT rendered — this produces GitHub's "chipped corner"
 * look when the period doesn't start on a Sunday or end on a Saturday.
 */
import type { HeatmapCell } from './activity-heatmap';

export interface HeatmapGridCell {
  /** Column index (0-based, weeks since start) */
  col: number;
  /** Row index (0 = Sunday ... 6 = Saturday) */
  row: number;
  /** The actual daily bucket for this cell */
  cell: HeatmapCell;
}

export interface MonthLabel {
  /** 3-letter month abbreviation, e.g. "Jan" */
  label: string;
  /** Column where the label should appear */
  col: number;
}

export interface HeatmapGrid {
  /** Rendered cells (cells inside the period) — column-major-friendly */
  cells: HeatmapGridCell[];
  /** Number of columns in the grid */
  columns: number;
  /** Month labels keyed to their starting column */
  months: MonthLabel[];
  /** Max jobCount across all cells (used for color scale normalization) */
  maxJobCount: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function parseUtcDate(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year!, (month ?? 1) - 1, day ?? 1));
}

/**
 * Build grid metadata from the per-day cells returned by the API.
 * The cells array is expected to be contiguous from startDate to endDate.
 */
export function buildHeatmapGrid(cells: HeatmapCell[]): HeatmapGrid {
  if (cells.length === 0) {
    return { cells: [], columns: 0, months: [], maxJobCount: 0 };
  }

  const first = parseUtcDate(cells[0]!.date);
  const firstDow = first.getUTCDay(); // 0=Sun...6=Sat

  const gridCells: HeatmapGridCell[] = [];
  let maxJobCount = 0;
  const monthsAdded = new Set<number>();
  const months: MonthLabel[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const dayIndex = firstDow + i; // absolute day index (0 = sunday of the first column)
    const col = Math.floor(dayIndex / 7);
    const row = dayIndex % 7;

    gridCells.push({ col, row, cell });
    if (cell.jobCount > maxJobCount) maxJobCount = cell.jobCount;

    // Month label: first time we see a given month, pin to its column
    const date = parseUtcDate(cell.date);
    const monthKey = date.getUTCFullYear() * 12 + date.getUTCMonth();
    if (!monthsAdded.has(monthKey)) {
      monthsAdded.add(monthKey);
      // Skip labeling the very first column's month if it's short (< 2 rows visible)
      // because the label would overlap the previous week's label in practice.
      const isFirstColumn = col === 0 && row > 3;
      if (!isFirstColumn) {
        months.push({ label: MONTH_NAMES[date.getUTCMonth()]!, col });
      }
    }
  }

  const columns = Math.floor((firstDow + cells.length - 1) / 7) + 1;

  return { cells: gridCells, columns, months, maxJobCount };
}

/**
 * Map a job count to a color bucket (0–4), where 0 = no activity.
 * Buckets are computed proportional to the max count in the period.
 */
export function getIntensityBucket(jobCount: number, maxJobCount: number): 0 | 1 | 2 | 3 | 4 {
  if (jobCount <= 0) return 0;
  if (maxJobCount <= 0) return 0;
  const ratio = jobCount / maxJobCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Pretty-format the per-day date as "Mon, Jan 1, 2024".
 */
export function formatCellDate(ymd: string): string {
  const d = parseUtcDate(ymd);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

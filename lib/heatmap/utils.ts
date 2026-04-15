import type { HeatmapCell, HeatmapDay } from './types';

export interface MonthLabel {
  text: string;
  column: number;
}

export interface DayLabel {
  text: string;
  row: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getPeriodBounds(year: string, now: Date): { start: Date; end: Date } {
  if (year === 'last-12-months') {
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // Advance end to Saturday of current week
    const endDay = end.getDay();
    if (endDay !== 6) {
      end.setDate(end.getDate() + (6 - endDay));
    }

    // Start is 52 full weeks before end's Sunday
    // end is Saturday, so the Sunday of that week is end - 6
    const sundayOfEndWeek = new Date(end);
    sundayOfEndWeek.setDate(sundayOfEndWeek.getDate() - 6);

    const start = new Date(sundayOfEndWeek);
    start.setDate(start.getDate() - 52 * 7);

    return { start, end };
  }

  const yearNum = parseInt(year, 10);
  return {
    start: new Date(yearNum, 0, 1),
    end: new Date(yearNum, 11, 31),
  };
}

export function buildHeatmapGrid(
  days: HeatmapDay[],
  periodStart: Date,
  periodEnd: Date
): (HeatmapCell | null)[][] {
  // Build a lookup map for day data
  const dayMap = new Map<string, HeatmapDay>();
  for (const day of days) {
    dayMap.set(day.date, day);
  }

  // Find the Sunday on or before periodStart
  const gridStart = new Date(periodStart);
  const startDay = gridStart.getDay();
  if (startDay !== 0) {
    gridStart.setDate(gridStart.getDate() - startDay);
  }

  // Find the Saturday on or after periodEnd
  const gridEnd = new Date(periodEnd);
  const endDay = gridEnd.getDay();
  if (endDay !== 6) {
    gridEnd.setDate(gridEnd.getDate() + (6 - endDay));
  }

  // Calculate number of weeks (columns)
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const numWeeks = Math.ceil(totalDays / 7);

  // Initialize 7 rows x numWeeks columns
  const grid: (HeatmapCell | null)[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: numWeeks }, () => null)
  );

  // Fill the grid
  const cursor = new Date(gridStart);
  for (let col = 0; col < numWeeks; col++) {
    for (let row = 0; row < 7; row++) {
      const currentDate = new Date(cursor);

      // Check if date is within the actual period bounds
      if (currentDate >= periodStart && currentDate <= periodEnd) {
        const dateKey = formatDateKey(currentDate);
        const dayData = dayMap.get(dateKey);

        grid[row]![col] = {
          date: currentDate,
          jobCount: dayData?.jobCount ?? 0,
          level: 0,
          costUsd: dayData?.costUsd ?? null,
          shippedTickets: dayData?.shippedTickets ?? [],
        };
      }
      // else: null (chipped corner)

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return grid;
}

export function computeIntensityLevels(cells: HeatmapCell[]): HeatmapCell[] {
  const activeCells = cells.filter((c) => c.jobCount > 0);

  if (activeCells.length === 0) {
    return cells;
  }

  const counts = activeCells.map((c) => c.jobCount).sort((a, b) => a - b);
  const q1 = counts[Math.floor(counts.length * 0.25)] ?? counts[0]!;
  const q2 = counts[Math.floor(counts.length * 0.5)] ?? counts[0]!;
  const q3 = counts[Math.floor(counts.length * 0.75)] ?? counts[0]!;

  return cells.map((cell) => {
    if (cell.jobCount === 0) {
      return { ...cell, level: 0 };
    }

    let level: 0 | 1 | 2 | 3 | 4;
    if (cell.jobCount <= q1) {
      level = 1;
    } else if (cell.jobCount <= q2) {
      level = 2;
    } else if (cell.jobCount <= q3) {
      level = 3;
    } else {
      level = 4;
    }

    // If all active cells have the same count, assign level 4
    if (q1 === q3) {
      level = 4;
    }

    return { ...cell, level };
  });
}

export function getMonthLabels(periodStart: Date, periodEnd: Date): MonthLabel[] {
  const labels: MonthLabel[] = [];

  // Find grid start (Sunday on or before periodStart)
  const gridStart = new Date(periodStart);
  const startDay = gridStart.getDay();
  if (startDay !== 0) {
    gridStart.setDate(gridStart.getDate() - startDay);
  }

  // Walk week by week and detect month transitions
  const cursor = new Date(gridStart);
  let col = 0;
  let lastMonth = -1;

  while (cursor <= periodEnd) {
    const month = cursor.getMonth();
    if (month !== lastMonth) {
      // Only add the label if the first of this month is within the period
      // or this is the first column
      labels.push({
        text: MONTH_NAMES[month]!,
        column: col,
      });
      lastMonth = month;
    }
    cursor.setDate(cursor.getDate() + 7);
    col++;
  }

  return labels;
}

export function getDayLabels(): DayLabel[] {
  return [
    { text: 'Mon', row: 1 },
    { text: 'Wed', row: 3 },
    { text: 'Fri', row: 5 },
  ];
}

export const INTENSITY_CLASSES = [
  'bg-muted',
  'bg-primary/20',
  'bg-primary/40',
  'bg-primary/60',
  'bg-primary/80',
] as const;

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

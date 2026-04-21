'use client';

import { useMemo, type ReactElement } from 'react';
import { ActivityHeatmapCell } from './activity-heatmap-cell';
import type { DailyCell } from '@/lib/analytics/heatmap-types';

interface ActivityHeatmapGridProps {
  cells: DailyCell[];
  startDate: string;
  endDate: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_LABELS = [
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
] as const;

function parseDateKey(key: string): Date {
  const parts = key.split('-');
  const [y, m, d] = parts;
  return new Date(
    Date.UTC(
      Number.parseInt(y!, 10),
      Number.parseInt(m!, 10) - 1,
      Number.parseInt(d!, 10)
    )
  );
}

interface GridLayout {
  columnCount: number;
  placed: Array<{ cell: DailyCell; column: number; row: number }>;
  monthLabels: Array<{ column: number; label: string }>;
}

function computeLayout(
  cells: DailyCell[],
  startDate: string,
  endDate: string
): GridLayout {
  if (cells.length === 0) {
    return { columnCount: 0, placed: [], monthLabels: [] };
  }

  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  const startDayOfWeek = start.getUTCDay();
  const firstSundayMs = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate() - startDayOfWeek
  );
  const dayMs = 24 * 60 * 60 * 1000;
  const endMs = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate()
  );
  const columnCount = Math.floor((endMs - firstSundayMs) / dayMs / 7) + 1;

  const placed: GridLayout['placed'] = [];
  const monthLabels: GridLayout['monthLabels'] = [];
  const seenMonthByColumn = new Set<number>();
  let previousMonth = -1;

  for (const cell of cells) {
    const dt = parseDateKey(cell.date);
    const ms = Date.UTC(
      dt.getUTCFullYear(),
      dt.getUTCMonth(),
      dt.getUTCDate()
    );
    const daysFromFirstSunday = Math.floor((ms - firstSundayMs) / dayMs);
    const column = Math.floor(daysFromFirstSunday / 7) + 1;
    const row = dt.getUTCDay() + 1;
    placed.push({ cell, column, row });

    const m = dt.getUTCMonth();
    if (m !== previousMonth && !seenMonthByColumn.has(column)) {
      monthLabels.push({ column, label: MONTH_LABELS[m] as string });
      seenMonthByColumn.add(column);
      previousMonth = m;
    }
  }

  return { columnCount, placed, monthLabels };
}

export function ActivityHeatmapGrid({
  cells,
  startDate,
  endDate,
}: ActivityHeatmapGridProps): ReactElement {
  const layout = useMemo(
    () => computeLayout(cells, startDate, endDate),
    [cells, startDate, endDate]
  );

  return (
    <div className="overflow-x-auto">
      <div className="flex justify-center min-w-max">
        <div className="flex flex-col gap-1">
          <div
            className="grid gap-[2px] pl-10"
            style={{
              gridTemplateColumns: `repeat(${layout.columnCount}, 14px)`,
            }}
            aria-hidden="true"
          >
            {layout.monthLabels.map((m) => (
              <span
                key={`month-${m.column}-${m.label}`}
                className="text-xs text-muted-foreground"
                style={{ gridColumn: m.column }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <div
              className="sticky left-0 z-10 grid grid-rows-7 gap-[2px] pr-1 bg-card"
              style={{
                gridTemplateRows: 'repeat(7, 14px)',
              }}
              aria-hidden="true"
            >
              {DAY_LABELS.map((label, idx) => (
                <span
                  key={label}
                  className="text-xs text-muted-foreground leading-none flex items-center"
                  style={{ gridRow: idx + 1, minHeight: 14 }}
                >
                  {idx % 2 === 1 ? label : ''}
                </span>
              ))}
            </div>
            <div
              role="grid"
              aria-label="Activity heatmap"
              className="grid gap-[2px]"
              style={{
                gridTemplateRows: 'repeat(7, 14px)',
                gridTemplateColumns: `repeat(${layout.columnCount}, 14px)`,
                gridAutoFlow: 'column',
              }}
            >
              {layout.placed.map((item) => (
                <ActivityHeatmapCell
                  key={item.cell.date}
                  cell={item.cell}
                  column={item.column}
                  row={item.row}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

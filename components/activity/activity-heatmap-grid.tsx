'use client';

import { useMemo } from 'react';
import { ActivityHeatmapCell } from './activity-heatmap-cell';
import type { HeatmapDay, HeatmapGridRange } from '@/lib/activity/heatmap-types';

interface ActivityHeatmapGridProps {
  days: HeatmapDay[];
  range: HeatmapGridRange;
}

type GridSlot =
  | { kind: 'data'; day: HeatmapDay; isoDate: string }
  | { kind: 'skeleton'; isoDate: string };

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' });

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function toIso(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(iso: string, n: number): string {
  const d = parseIsoDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

interface MonthLabel {
  label: string;
  weekIndex: number;
}

function buildColumns(range: HeatmapGridRange, days: HeatmapDay[]): {
  columns: GridSlot[][];
  monthLabels: MonthLabel[];
} {
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const columns: GridSlot[][] = [];
  const monthLabels: MonthLabel[] = [];
  let lastMonth = -1;

  let cursor = range.gridStart;
  let weekIndex = 0;
  while (cursor <= range.gridEnd) {
    const week: GridSlot[] = [];
    for (let i = 0; i < 7; i += 1) {
      const iso = addDays(cursor, i);
      const inRange = iso >= range.startDate && iso <= range.endDate;
      const day = inRange ? dayMap.get(iso) : undefined;
      week.push(day ? { kind: 'data', day, isoDate: iso } : { kind: 'skeleton', isoDate: iso });
    }
    // Month label: pulled from first in-range day of this column
    const firstInRange = week.find((s) => s.kind === 'data');
    if (firstInRange) {
      const date = parseIsoDate(firstInRange.isoDate);
      const month = date.getUTCMonth();
      if (month !== lastMonth) {
        monthLabels.push({ label: MONTH_FORMATTER.format(date), weekIndex });
        lastMonth = month;
      }
    }
    columns.push(week);
    cursor = addDays(cursor, 7);
    weekIndex += 1;
  }

  return { columns, monthLabels };
}

export function ActivityHeatmapGrid({ days, range }: ActivityHeatmapGridProps) {
  const { columns, monthLabels } = useMemo(() => buildColumns(range, days), [days, range]);

  return (
    <div
      className="overflow-x-auto"
      data-testid="activity-heatmap-grid"
      role="grid"
      aria-label="Activity heatmap"
    >
      <div className="inline-flex gap-1 pb-2">
        <div className="flex flex-col gap-1 pr-2 pt-5 text-[10px] text-muted-foreground">
          {DAY_LABELS.map((label, i) => (
            <span
              key={label}
              className="h-[14px] leading-[14px]"
              // Only show Mon, Wed, Fri to reduce clutter (like GitHub)
              style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <div className="relative h-4">
            {monthLabels.map(({ label, weekIndex }) => (
              <span
                key={`${label}-${weekIndex}`}
                className="absolute text-[10px] text-muted-foreground"
                style={{ left: `${weekIndex * 18}px` }}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {columns.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((slot) =>
                  slot.kind === 'data' ? (
                    <ActivityHeatmapCell key={slot.isoDate} day={slot.day} />
                  ) : (
                    <span
                      key={slot.isoDate}
                      className="block h-[14px] w-[14px]"
                      aria-hidden="true"
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

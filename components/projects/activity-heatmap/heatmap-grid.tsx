'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { HeatmapDay, HeatmapMeta } from '@/lib/analytics/heatmap-types';
import { HeatmapTooltipContent } from './heatmap-tooltip';

export function getLevelClass(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 0:
      return 'bg-zinc-800/40';
    case 1:
      return 'bg-violet-900';
    case 2:
      return 'bg-violet-800';
    case 3:
      return 'bg-violet-700';
    case 4:
      return 'bg-violet-500';
  }
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

type GridCell =
  | { kind: 'day'; dateKey: string; day: HeatmapDay }
  | { kind: 'future'; dateKey: string; day: HeatmapDay }
  | { kind: 'chip'; dateKey: string };

interface WeekColumn {
  cells: GridCell[];
  firstDayKey: string;
  month: number;
}

function parseDayKey(key: string): Date {
  const [yearStr, monthStr, dayStr] = key.split('-');
  return new Date(
    Date.UTC(
      parseInt(yearStr ?? '1970', 10),
      parseInt(monthStr ?? '01', 10) - 1,
      parseInt(dayStr ?? '01', 10)
    )
  );
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function dayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildWeeks(days: HeatmapDay[], meta: HeatmapMeta, todayKey: string): WeekColumn[] {
  if (days.length === 0 || !meta.rangeStart || !meta.rangeEnd) return [];

  const rangeStart = parseDayKey(meta.rangeStart);
  const rangeEnd = parseDayKey(meta.rangeEnd);
  const periodEndYear = rangeEnd.getUTCFullYear();

  const startDow = rangeStart.getUTCDay();
  const gridStart = addDays(rangeStart, -startDow);

  let gridEndSource = rangeEnd;
  const isCalendarYearCurrent =
    meta.rangeStart === `${periodEndYear}-01-01` &&
    parseDayKey(todayKey).getUTCFullYear() === periodEndYear &&
    meta.rangeEnd === todayKey;
  const yearEndKey = `${periodEndYear}-12-31`;
  if (isCalendarYearCurrent) {
    gridEndSource = parseDayKey(yearEndKey);
  }

  const endDow = gridEndSource.getUTCDay();
  const gridEnd = addDays(gridEndSource, 6 - endDow);

  const byDay = new Map<string, HeatmapDay>();
  for (const d of days) byDay.set(d.date, d);

  const weeks: WeekColumn[] = [];
  let cursor = gridStart;
  while (cursor.getTime() <= gridEnd.getTime()) {
    const cells: GridCell[] = [];
    for (let i = 0; i < 7; i += 1) {
      const key = dayKey(cursor);
      const day = byDay.get(key);
      if (day) {
        cells.push({ kind: 'day', day, dateKey: key });
      } else if (
        isCalendarYearCurrent &&
        key > todayKey &&
        key <= yearEndKey
      ) {
        cells.push({
          kind: 'future',
          dateKey: key,
          day: { date: key, jobCount: 0, totalCost: null, shippedTickets: [], level: 0 },
        });
      } else {
        cells.push({ kind: 'chip', dateKey: key });
      }
      cursor = addDays(cursor, 1);
    }
    const firstDayCell = cells[0];
    weeks.push({
      cells,
      firstDayKey: firstDayCell?.dateKey ?? '',
      month: firstDayCell ? parseDayKey(firstDayCell.dateKey).getUTCMonth() : 0,
    });
  }
  return weeks;
}

function buildMonthLabels(weeks: WeekColumn[]): Array<{ weekIndex: number; label: string }> {
  const labels: Array<{ weekIndex: number; label: string }> = [];
  let previousMonth = -1;
  weeks.forEach((w, idx) => {
    if (w.month !== previousMonth) {
      labels.push({ weekIndex: idx, label: MONTH_LABELS[w.month] ?? '' });
      previousMonth = w.month;
    }
  });
  return labels;
}

interface HeatmapGridProps {
  days: HeatmapDay[];
  meta: HeatmapMeta;
  isEmpty: boolean;
  todayKey: string;
  emptyMessage?: string;
}

export function HeatmapGrid({
  days,
  meta,
  isEmpty,
  todayKey,
  emptyMessage = 'No activity to show yet — your AI work will appear here',
}: HeatmapGridProps) {
  const weeks = buildWeeks(days, meta, todayKey);
  const monthLabels = buildMonthLabels(weeks);

  if (isEmpty) {
    return (
      <div
        data-testid="activity-heatmap-empty-state"
        className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex gap-3" data-testid="activity-heatmap-grid">
      <div className="flex flex-col gap-1 pt-6 text-[10px] text-muted-foreground select-none">
        {DAY_LABELS.map((label, idx) => (
          <span
            key={label}
            className={cn('h-[14px] leading-[14px]', idx % 2 === 0 ? 'opacity-0' : 'opacity-100')}
            aria-hidden={idx % 2 === 0 ? 'true' : undefined}
          >
            {label}
          </span>
        ))}
      </div>
      <ScrollArea className="w-full">
        <div className="relative inline-block min-w-full">
          <div className="relative h-5 text-[10px] text-muted-foreground">
            {monthLabels.map(({ weekIndex, label }) => (
              <span
                key={`${weekIndex}-${label}`}
                className="absolute"
                style={{ left: `${weekIndex * 16}px` }}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.cells.map((cell, ci) => {
                  if (cell.kind === 'chip') {
                    return (
                      <span
                        key={`${wi}-${ci}`}
                        aria-hidden="true"
                        className="h-[14px] w-[14px]"
                      />
                    );
                  }
                  return (
                    <HeatmapCell
                      key={`${wi}-${ci}`}
                      day={cell.day}
                      isFuture={cell.kind === 'future'}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function HeatmapCell({ day, isFuture }: { day: HeatmapDay; isFuture: boolean }) {
  const className = cn(
    'h-[14px] w-[14px] rounded-sm transition-colors',
    getLevelClass(isFuture ? 0 : day.level),
    isFuture && 'opacity-60'
  );
  const ariaLabel = `${day.date}: ${day.jobCount} ${day.jobCount === 1 ? 'job' : 'jobs'}`;

  const trigger = (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      data-testid="activity-heatmap-cell"
      data-date={day.date}
      data-level={isFuture ? 0 : day.level}
      data-future={isFuture ? 'true' : undefined}
    />
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <HeatmapTooltipContent day={day} />
      </PopoverContent>
    </Popover>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { HeatmapDay } from '@/lib/heatmap/types';

interface ActivityHeatmapGridProps {
  days: HeatmapDay[];
  startDate: string;
  endDate: string;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VISIBLE_WEEKDAY_LABELS = new Set(['Mon', 'Wed', 'Fri']);
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const INTENSITY_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-muted/40 border border-border/40',
  1: 'bg-violet-200 dark:bg-violet-900/50',
  2: 'bg-violet-400 dark:bg-violet-700',
  3: 'bg-violet-500 dark:bg-violet-600',
  4: 'bg-violet-600 dark:bg-violet-400',
};

function parseIsoDate(iso: string): Date {
  const parts = iso.split('-');
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function formatDateLong(iso: string): string {
  const d = parseIsoDate(iso);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(d);
}

interface WeekColumn {
  weekIndex: number;
  cells: (HeatmapDay | null)[];
  monthLabel: string | null;
}

function buildWeeks(days: HeatmapDay[], startIso: string): WeekColumn[] {
  if (days.length === 0) return [];

  const startDate = parseIsoDate(startIso);
  const startWeekday = startDate.getUTCDay();
  const weeks: WeekColumn[] = [];
  let lastMonthLabeled = -1;

  for (let i = 0; i < days.length; i += 1) {
    const position = startWeekday + i;
    const weekIndex = Math.floor(position / 7);
    const weekday = position % 7;

    if (!weeks[weekIndex]) {
      weeks[weekIndex] = {
        weekIndex,
        cells: [null, null, null, null, null, null, null],
        monthLabel: null,
      };
    }
    const day = days[i]!;
    weeks[weekIndex]!.cells[weekday] = day;

    const d = parseIsoDate(day.date);
    const month = d.getUTCMonth();
    if (month !== lastMonthLabeled && d.getUTCDate() <= 7) {
      weeks[weekIndex]!.monthLabel = MONTH_LABELS[month] ?? null;
      lastMonthLabeled = month;
    }
  }

  return weeks;
}

export function ActivityHeatmapGrid({ days, startDate, endDate }: ActivityHeatmapGridProps) {
  const weeks = useMemo(() => buildWeeks(days, startDate), [days, startDate]);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openDate) return;
    function handleDocumentTap(event: PointerEvent) {
      if (!gridRef.current) return;
      const target = event.target as Node | null;
      if (target && gridRef.current.contains(target)) return;
      setOpenDate(null);
    }
    document.addEventListener('pointerdown', handleDocumentTap);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentTap);
    };
  }, [openDate]);

  if (weeks.length === 0) {
    return (
      <div
        className="min-h-[140px] rounded-md border border-border/40 bg-card/40"
        data-testid="activity-heatmap-grid"
        data-end-date={endDate}
      />
    );
  }

  return (
    <div
      className="overflow-x-auto"
      data-testid="activity-heatmap-grid"
      data-end-date={endDate}
    >
      <div ref={gridRef} className="inline-flex min-w-min flex-col gap-1 pt-4 relative">
        <div className="flex items-stretch">
          <div
            className="sticky left-0 z-10 flex flex-col gap-1 bg-background pr-2 text-[10px] text-muted-foreground"
            data-testid="activity-heatmap-weekdays"
          >
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="h-3 w-6 leading-3"
                data-weekday={label}
              >
                {VISIBLE_WEEKDAY_LABELS.has(label) ? label : ''}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            {weeks.map((week) => (
              <div
                key={week.weekIndex}
                className="flex flex-col gap-1 relative"
                data-week-index={week.weekIndex}
              >
                <div
                  className="absolute -top-4 left-0 text-[10px] text-muted-foreground h-4 leading-4 whitespace-nowrap"
                  data-testid={week.monthLabel ? 'activity-heatmap-month-label' : undefined}
                >
                  {week.monthLabel ?? ''}
                </div>
                {week.cells.map((day, weekday) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${week.weekIndex}-${weekday}`}
                        aria-hidden="true"
                        className="h-3 w-3"
                        data-testid="activity-heatmap-empty-cell"
                      />
                    );
                  }

                  const intensityClass = INTENSITY_CLASSES[day.intensity];
                  const dateLong = formatDateLong(day.date);
                  const ariaLabel = `${dateLong}, ${day.jobCount} ${day.jobCount === 1 ? 'job' : 'jobs'}`;
                  const isOpen = openDate === day.date;

                  return (
                    <Tooltip
                      key={day.date}
                      open={isOpen}
                      onOpenChange={(next) => {
                        if (next) {
                          setOpenDate(day.date);
                        } else if (openDate === day.date) {
                          setOpenDate(null);
                        }
                      }}
                    >
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className={`h-3 w-3 rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${intensityClass}`}
                          aria-label={ariaLabel}
                          data-testid={`activity-heatmap-cell-${day.date}`}
                          data-intensity={day.intensity}
                          data-has-cost={day.hasAnyCost ? 'true' : 'false'}
                          onClick={() => {
                            setOpenDate((prev) => (prev === day.date ? null : day.date));
                          }}
                          onFocus={() => setOpenDate(day.date)}
                          onBlur={() =>
                            setOpenDate((prev) => (prev === day.date ? null : prev))
                          }
                        />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs space-y-1 bg-popover text-popover-foreground border border-border">
                        <p className="font-medium">{dateLong}</p>
                        {day.shippedTickets.length > 0 && (
                          <ul className="space-y-0.5 text-xs">
                            {day.shippedTickets.map((ticket) => (
                              <li key={ticket.ticketKey}>
                                {ticket.ticketKey} — {ticket.title}
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="text-xs">
                          {day.hasAnyCost
                            ? `${day.jobCount} ${day.jobCount === 1 ? 'job' : 'jobs'} · $${day.sumCostUsd.toFixed(2)}`
                            : `${day.jobCount} ${day.jobCount === 1 ? 'job' : 'jobs'}`}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  buildHeatmapGrid,
  computeIntensityThresholds,
  formatHeatmapCost,
  formatTooltipDate,
  getIntensityBucket,
  parseIsoDate,
} from '@/lib/activity-heatmap/aggregations';
import type { HeatmapData, HeatmapDayCell } from '@/lib/activity-heatmap/types';

interface HeatmapGridProps {
  data: HeatmapData;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Violet aurora-themed intensity scale.
// Index 0 is the empty/no-activity color; 1..4 are increasing violet intensities.
// Using static class strings (no dynamic concatenation) so Tailwind's purger keeps them.
const INTENSITY_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-muted/40 dark:bg-muted/30',
  1: 'bg-violet-200 dark:bg-violet-900/60',
  2: 'bg-violet-400 dark:bg-violet-700/80',
  3: 'bg-violet-500 dark:bg-violet-500',
  4: 'bg-violet-700 dark:bg-violet-300',
};

const CELL_SIZE = 'h-3 w-3 sm:h-3.5 sm:w-3.5';
const CELL_GAP = 'gap-[3px]';

export function HeatmapGrid({ data }: HeatmapGridProps) {
  const grid = useMemo(
    () => buildHeatmapGrid(parseIsoDate(data.startDate), parseIsoDate(data.endDate)),
    [data.startDate, data.endDate]
  );

  const dayMap = useMemo(() => {
    const map = new Map<string, HeatmapDayCell>();
    for (const day of data.days) map.set(day.date, day);
    return map;
  }, [data.days]);

  const thresholds = useMemo(
    () => computeIntensityThresholds(data.days.map((d) => d.jobCount)),
    [data.days]
  );

  const totalActivity = data.totalJobs;
  const isEmpty = totalActivity === 0;

  return (
    <div className="relative w-full">
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex min-w-full flex-col">
          {/* Month labels */}
          <div className={`flex pl-10 ${CELL_GAP}`}>
            {grid.monthLabels.map((label, i) => (
              <div
                key={`m-${i}`}
                className={`${CELL_SIZE} text-[10px] leading-none text-muted-foreground`}
              >
                {label ? <span className="block -translate-y-2">{label}</span> : null}
              </div>
            ))}
          </div>

          {isEmpty ? (
            <div className="flex min-h-[140px] items-center justify-center pl-10">
              <p
                className="text-sm text-muted-foreground"
                data-testid="activity-heatmap-empty"
              >
                No activity to show yet — your AI work will appear here
              </p>
            </div>
          ) : (
            <div className="relative flex">
              {/* Sticky weekday labels */}
              <div
                className={`sticky left-0 z-10 mr-1 flex flex-col bg-background ${CELL_GAP}`}
                aria-hidden="true"
              >
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className={`${CELL_SIZE} text-[10px] leading-none text-muted-foreground`}
                  >
                    {/* Show every other label to avoid crowding */}
                    {i % 2 === 1 ? <span className="block">{label}</span> : null}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              <TooltipProvider delayDuration={120}>
                <div className={`flex ${CELL_GAP}`}>
                  {grid.columns.map((column, colIdx) => (
                    <div
                      key={`c-${colIdx}`}
                      className={`flex flex-col ${CELL_GAP}`}
                    >
                      {column.map((cell, rowIdx) => {
                        if (!cell.date) {
                          return (
                            <div
                              key={`e-${colIdx}-${rowIdx}`}
                              className={`${CELL_SIZE}`}
                              aria-hidden="true"
                            />
                          );
                        }
                        const day = dayMap.get(cell.date);
                        const bucket = getIntensityBucket(day?.jobCount ?? 0, thresholds);
                        const colorClass = INTENSITY_CLASSES[bucket];
                        return (
                          <Tooltip key={cell.date}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={`${CELL_SIZE} ${colorClass} rounded-sm transition-all hover:ring-1 hover:ring-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500`}
                                aria-label={buildCellAriaLabel(cell.date, day)}
                                data-testid="activity-heatmap-cell"
                                data-date={cell.date}
                                data-job-count={day?.jobCount ?? 0}
                              />
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-[260px] bg-popover text-popover-foreground border border-border"
                            >
                              <CellTooltipContent date={cell.date} day={day} />
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          )}
        </div>
      </div>

      {/* Intensity legend */}
      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((bucket) => (
          <span
            key={bucket}
            className={`${CELL_SIZE} ${INTENSITY_CLASSES[bucket]} rounded-sm`}
            aria-hidden="true"
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

function buildCellAriaLabel(iso: string, day: HeatmapDayCell | undefined): string {
  const dateLabel = formatTooltipDate(iso);
  const jobCount = day?.jobCount ?? 0;
  const shippedCount = day?.shippedTickets.length ?? 0;
  if (jobCount === 0 && shippedCount === 0) {
    return `${dateLabel}: no activity`;
  }
  const parts: string[] = [];
  if (jobCount > 0) {
    parts.push(`${jobCount} job${jobCount === 1 ? '' : 's'}`);
  }
  if (shippedCount > 0) {
    parts.push(`${shippedCount} ticket${shippedCount === 1 ? '' : 's'} shipped`);
  }
  return `${dateLabel}: ${parts.join(', ')}`;
}

interface CellTooltipContentProps {
  date: string;
  day: HeatmapDayCell | undefined;
}

function CellTooltipContent({ date, day }: CellTooltipContentProps) {
  const formattedDate = formatTooltipDate(date);
  const jobCount = day?.jobCount ?? 0;
  const shippedTickets = day?.shippedTickets ?? [];

  if (jobCount === 0 && shippedTickets.length === 0) {
    return (
      <div className="space-y-1 py-1 text-xs">
        <div className="font-medium">{formattedDate}</div>
        <div className="text-muted-foreground">No activity</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 py-1 text-xs">
      <div className="font-medium">{formattedDate}</div>

      {jobCount > 0 && (
        <div>
          {jobCount} job{jobCount === 1 ? '' : 's'}
          {day?.hasCost ? ` · ${formatHeatmapCost(day.totalCostUsd)}` : ''}
        </div>
      )}

      {shippedTickets.length > 0 && (
        <div className="space-y-0.5 border-t border-border pt-1.5">
          <div className="font-medium">
            {shippedTickets.length} shipped
          </div>
          <ul className="space-y-0.5">
            {shippedTickets.slice(0, 5).map((ticket) => (
              <li key={ticket.ticketKey} className="truncate">
                <span className="font-mono text-muted-foreground">
                  {ticket.ticketKey}
                </span>{' '}
                {ticket.title}
              </li>
            ))}
            {shippedTickets.length > 5 && (
              <li className="text-muted-foreground">
                +{shippedTickets.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

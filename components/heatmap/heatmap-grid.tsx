'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  buildWeeks,
  formatCost,
  formatTooltipDate,
  intensityClass,
  intensityLevel,
  monthLabels,
} from '@/lib/heatmap/aggregations';
import type { HeatmapDay } from '@/lib/heatmap/types';
import { cn } from '@/lib/utils';

interface HeatmapGridProps {
  days: HeatmapDay[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL_SIZE = 'h-[12px] w-[12px] sm:h-[13px] sm:w-[13px]';

export function HeatmapGrid({ days }: HeatmapGridProps) {
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const dayByDate = useMemo(() => {
    const map = new Map<string, HeatmapDay>();
    for (const day of days) map.set(day.date, day);
    return map;
  }, [days]);

  const columns = useMemo(() => buildWeeks(days.map((d) => d.date)), [days]);
  const labels = useMemo(() => monthLabels(columns), [columns]);
  const maxCount = useMemo(() => days.reduce((max, d) => Math.max(max, d.jobCount), 0), [days]);

  useEffect(() => {
    if (activeCell === null) return;
    const handler = (event: MouseEvent | TouchEvent) => {
      if (!gridRef.current) return;
      if (gridRef.current.contains(event.target as Node)) return;
      setActiveCell(null);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [activeCell]);

  return (
    <div className="relative">
      <div ref={gridRef} className="flex gap-2 overflow-x-auto pb-3">
        <div
          className="sticky left-0 z-10 flex flex-col gap-[3px] pt-[18px] pr-1 bg-background"
          aria-hidden="true"
        >
          {DAY_LABELS.map((label, idx) => (
            <div
              key={label}
              className={cn(
                'flex items-center text-[10px] text-muted-foreground leading-none',
                CELL_SIZE,
                // Show only Mon / Wed / Fri to match GitHub
                idx % 2 === 0 ? 'opacity-0' : ''
              )}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-[3px]">
          <div className="flex gap-[3px] h-[14px]">
            {columns.map((_, idx) => (
              <div
                key={`month-${idx}`}
                className={cn('text-[10px] text-muted-foreground leading-none', CELL_SIZE)}
              >
                {labels[idx]}
              </div>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {columns.map((column, colIdx) => (
              <div key={`col-${colIdx}`} className="flex flex-col gap-[3px]">
                {column.days.map((date, rowIdx) => {
                  if (date === null) {
                    return (
                      <div
                        key={`empty-${colIdx}-${rowIdx}`}
                        className={cn(CELL_SIZE)}
                        aria-hidden="true"
                      />
                    );
                  }
                  const day = dayByDate.get(date);
                  if (!day) return null;
                  const level = intensityLevel(day.jobCount, maxCount);
                  const isActive = activeCell === date;
                  return (
                    <button
                      key={date}
                      type="button"
                      className={cn(
                        CELL_SIZE,
                        'rounded-[2px] transition-opacity focus:outline-none focus:ring-2 focus:ring-violet-400',
                        intensityClass(level),
                        isActive && 'ring-2 ring-violet-300'
                      )}
                      aria-label={`${day.jobCount} jobs on ${formatTooltipDate(date)}`}
                      onMouseEnter={() => setActiveCell(date)}
                      onMouseLeave={() => setActiveCell((current) => (current === date ? null : current))}
                      onFocus={() => setActiveCell(date)}
                      onClick={() => setActiveCell((current) => (current === date ? null : date))}
                      data-testid={`heatmap-cell-${date}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {activeCell && <HeatmapTooltip day={dayByDate.get(activeCell)!} />}
    </div>
  );
}

function HeatmapTooltip({ day }: { day: HeatmapDay }) {
  return (
    <div
      role="tooltip"
      className="mt-2 inline-block rounded-md border border-border/60 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
      data-testid="heatmap-tooltip"
    >
      <div className="font-medium">{formatTooltipDate(day.date)}</div>
      <div className="text-muted-foreground">
        {day.jobCount === 0 ? 'No activity' : `${day.jobCount} job${day.jobCount === 1 ? '' : 's'}`}
        {day.totalCost != null && day.jobCount > 0 && (
          <> · {formatCost(day.totalCost)}</>
        )}
      </div>
      {day.ticketsShipped > 0 && (
        <div className="text-muted-foreground">
          {day.ticketsShipped} ticket{day.ticketsShipped === 1 ? '' : 's'} shipped
        </div>
      )}
    </div>
  );
}

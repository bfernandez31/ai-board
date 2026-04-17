'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getIntensityClass } from '@/lib/activity/heatmap-bucketing';
import type { HeatmapDay } from '@/lib/activity/heatmap-types';

interface ActivityHeatmapCellProps {
  day: HeatmapDay;
}

function formatReadableDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((p) => Number.parseInt(p, 10));
  const yy = y ?? 1970;
  const mm = m ?? 1;
  const dd = d ?? 1;
  const date = new Date(Date.UTC(yy, mm - 1, dd));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function ActivityHeatmapCell({ day }: ActivityHeatmapCellProps) {
  const intensityClass = getIntensityClass(day.intensity);
  const ariaLabel = `${formatReadableDate(day.date)}: ${day.jobCount} jobs, ${day.ticketsShipped} tickets shipped`;
  const dateLabel = formatReadableDate(day.date);

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          data-testid="activity-heatmap-cell"
          data-date={day.date}
          data-intensity={day.intensity}
          className={`block h-[14px] w-[14px] rounded-sm transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${intensityClass}`}
        />
      </TooltipTrigger>
      <TooltipContent side="top">
        <div className="text-xs leading-relaxed">
          <div className="font-medium">{dateLabel}</div>
          <div>
            {day.ticketsShipped} {day.ticketsShipped === 1 ? 'ticket' : 'tickets'} shipped
          </div>
          <div>
            {day.jobCount} jobs
            {day.totalCostUsd !== undefined ? ` · $${day.totalCostUsd.toFixed(2)}` : ''}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

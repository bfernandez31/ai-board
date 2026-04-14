'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { IntensityLevel } from '@/lib/heatmap/types';

const INTENSITY_CLASSES: Record<IntensityLevel, string> = {
  0: 'bg-muted/50',
  1: 'bg-violet-900/40',
  2: 'bg-violet-700/50',
  3: 'bg-violet-500/60',
  4: 'bg-violet-400/80',
};

interface HeatmapCellProps {
  date: string;
  intensity: IntensityLevel;
  jobCount: number;
  costUsd: number | null;
  ticketsShipped: number;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCost(costUsd: number | null): string {
  if (costUsd === null) return '';
  return ` · $${costUsd.toFixed(2)}`;
}

export function HeatmapCell({ date, intensity, jobCount, costUsd, ticketsShipped }: HeatmapCellProps) {
  const hasActivity = jobCount > 0 || ticketsShipped > 0;

  const tooltipContent = hasActivity
    ? `${ticketsShipped} ticket${ticketsShipped !== 1 ? 's' : ''} shipped · ${jobCount} job${jobCount !== 1 ? 's' : ''}${formatCost(costUsd)}`
    : 'No activity';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`w-[13px] h-[13px] rounded-[2px] ${INTENSITY_CLASSES[intensity]} cursor-default`}
          data-date={date}
          data-testid="heatmap-cell"
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <p>{tooltipContent}</p>
        <p className="text-muted-foreground">{formatDate(date)}</p>
      </TooltipContent>
    </Tooltip>
  );
}

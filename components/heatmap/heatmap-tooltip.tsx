import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import type { HeatmapDay } from '@/lib/heatmap/types';

interface HeatmapTooltipProps {
  day: HeatmapDay | null;
  date: Date;
  level: number;
}

function formatLongDate(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[date.getUTCDay()]}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function HeatmapTooltip({ day, date, level }: HeatmapTooltipProps) {
  const ariaLabel = day
    ? `${day.jobCount} jobs on ${formatLongDate(date)}`
    : `No activity on ${formatLongDate(date)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`heatmap-level-${level} rounded-sm cursor-default`}
          style={{ width: '12px', height: '12px' }}
          role="gridcell"
          aria-label={ariaLabel}
        />
      </TooltipTrigger>
      <TooltipContent
        className="max-w-[240px] bg-popover text-popover-foreground border border-border shadow-md"
        sideOffset={5}
      >
        <div className="space-y-1">
          <p className="font-medium text-xs">{formatLongDate(date)}</p>

          {day && day.jobCount > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">
                {day.jobCount} {day.jobCount === 1 ? 'job' : 'jobs'}
                {day.costUsd !== null && ` · ${formatCost(day.costUsd)}`}
              </p>

              {day.shippedTickets.length > 0 && (
                <div className="pt-1 border-t border-border">
                  <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Shipped</p>
                  {day.shippedTickets.map((ticket) => (
                    <p key={ticket.ticketKey} className="text-xs truncate">
                      <span className="text-ctp-mauve font-medium">{ticket.ticketKey}</span>{' '}
                      <span className="text-muted-foreground">{ticket.title}</span>
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No activity</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

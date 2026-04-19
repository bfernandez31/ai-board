'use client';

import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface HeatmapTooltipProps {
  date: string;
  data?: {
    jobCount: number;
    totalCost: number | null;
    shippedTickets: { id: number; ticketKey: string; title: string }[];
  } | undefined;
}

export function HeatmapTooltip({ date, data }: HeatmapTooltipProps) {
  const formattedDate = format(new Date(date), 'MMMM d, yyyy');
  const jobCount = data?.jobCount ?? 0;
  const cost = data?.totalCost;

  return (
    <div className="p-3 bg-popover text-popover-foreground rounded-lg shadow-xl border border-accent/20 min-w-[200px] max-w-[300px]">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {formattedDate}
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center text-sm">
          <span className="font-semibold">{jobCount} jobs</span>
          {cost !== null && cost !== undefined && (
            <span className="text-ctp-mauve font-medium">
              ${cost.toFixed(2)}
            </span>
          )}
        </div>

        {data?.shippedTickets && data.shippedTickets.length > 0 && (
          <div className="pt-2 border-t border-accent/10">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              Tickets Shipped
            </div>
            <div className="space-y-1">
              {data.shippedTickets.map((ticket) => (
                <div key={ticket.id} className="flex gap-2 items-start text-xs">
                  <Badge variant="outline" className="h-4 px-1 text-[9px] font-mono shrink-0 bg-ctp-mauve/10 border-ctp-mauve/20 text-ctp-mauve">
                    {ticket.ticketKey}
                  </Badge>
                  <span className="line-clamp-1">{ticket.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {jobCount === 0 && (
          <div className="text-xs text-muted-foreground italic">
            No activity recorded
          </div>
        )}
      </div>
    </div>
  );
}

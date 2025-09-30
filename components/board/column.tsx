import { ScrollArea } from '@/components/ui/scroll-area';
import { TicketCard } from './ticket-card';
import { getStageConfig } from '@/lib/utils/stage';
import type { ColumnProps } from '@/lib/types';

/**
 * Column Component (Server Component)
 * Displays a single workflow stage column with tickets
 * - Stage header with name, color, and count
 * - Scrollable ticket list
 */
export function Column({ stage, tickets }: ColumnProps) {
  const stageConfig = getStageConfig(stage);
  const ticketCount = tickets.length;

  return (
    <div className="flex flex-col h-full min-w-[280px]">
      {/* Column Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          {/* Color indicator */}
          <div
            className={`w-3 h-3 rounded-full ${stageConfig.bgColor}`}
            aria-hidden="true"
          />
          {/* Stage name */}
          <h2 className="font-semibold text-lg">{stageConfig.label}</h2>
        </div>
        {/* Ticket count */}
        <p className="text-sm text-muted-foreground ml-5">
          {ticketCount} {ticketCount === 1 ? 'ticket' : 'tickets'}
        </p>
      </div>

      {/* Tickets Scroll Area */}
      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
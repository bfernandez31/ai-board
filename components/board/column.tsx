import { ScrollArea } from '@/components/ui/scroll-area';
import { TicketCard } from './ticket-card';
import { NewTicketButton } from './new-ticket-button';
import { getStageConfig } from '@/lib/utils/stage';
import type { ColumnProps } from '@/lib/types';

/**
 * Column Component (Server Component)
 * Displays a single workflow stage column with tickets
 * - Stage header with name, color, and count badge
 * - Scrollable ticket list
 * - New ticket button
 */
export function Column({ stage, tickets }: ColumnProps) {
  const stageConfig = getStageConfig(stage);
  const ticketCount = tickets.length;
  const showNewTicketButton = stageConfig.order === 0;

  return (
    <div
      data-testid={`column-${stage}`}
      data-column={stage}
      data-stage={stage}
      className={`flex flex-col h-full min-w-[280px] rounded-lg border overflow-hidden shadow-[0_0_24px_rgba(0,0,0,0.35)] transition-all duration-300 ${stageConfig.bgColor} ${stageConfig.borderColor}`}
    >
      {/* Column Header */}
      <div
        className={`${stageConfig.headerBgColor} border-b ${stageConfig.headerBorderColor} px-4 py-2.5`}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Stage name */}
          <h2 className={`text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${stageConfig.textColor}`}>
            {stageConfig.label}
          </h2>
          {/* Ticket count badge */}
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.58rem] font-semibold shadow-[0_0_8px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/10 ${stageConfig.badgeBgColor} ${stageConfig.badgeTextColor}`}
          >
            {ticketCount}
          </span>
        </div>
      </div>

      {/* Tickets Scroll Area */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 px-4 pb-5 pt-3">
          {/* New Ticket Button */}
          {showNewTicketButton ? <NewTicketButton stage={stage} /> : null}

          {/* Ticket Cards */}
          {tickets.length > 0 ? (
            tickets.map((ticket) => <TicketCard key={ticket.id} ticket={ticket} />)
          ) : (
            <div className="text-center text-sm text-zinc-400/90 py-12 font-medium">
              No tickets
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

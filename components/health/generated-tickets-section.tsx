'use client';

import { Ticket } from 'lucide-react';
import { useGeneratedTickets } from '@/app/lib/hooks/useGeneratedTickets';

const STAGE_COLORS: Record<string, string> = {
  INBOX: 'text-muted-foreground bg-muted',
  SPECIFY: 'text-ctp-blue bg-ctp-blue/10',
  PLAN: 'text-ctp-blue bg-ctp-blue/10',
  BUILD: 'text-ctp-yellow bg-ctp-yellow/10',
  VERIFY: 'text-ctp-peach bg-ctp-peach/10',
  SHIP: 'text-ctp-green bg-ctp-green/10',
};

interface GeneratedTicketsSectionProps {
  projectId: number;
  scanId: number | null;
}

export function GeneratedTicketsSection({ projectId, scanId }: GeneratedTicketsSectionProps) {
  const { data, isLoading } = useGeneratedTickets(projectId, scanId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">Generated Tickets</h3>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const tickets = data?.tickets ?? [];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Ticket className="h-4 w-4 text-muted-foreground" />
        Generated Tickets
      </h3>
      {tickets.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No tickets were generated from this scan.
        </p>
      ) : (
        <div className="space-y-1.5">
          {tickets.map((ticket) => {
            const stageColors = STAGE_COLORS[ticket.stage] ?? STAGE_COLORS.INBOX;
            return (
              <div
                key={ticket.id}
                className="flex items-center gap-2 p-2 rounded-md aurora-glass text-sm"
              >
                <span className="font-mono text-xs text-ctp-blue font-medium shrink-0">
                  {ticket.ticketKey}
                </span>
                <span className="text-muted-foreground truncate flex-1">
                  {ticket.title}
                </span>
                <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 shrink-0 ${stageColors}`}>
                  {ticket.stage}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

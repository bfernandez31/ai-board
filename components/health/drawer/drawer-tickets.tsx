'use client';

import { ExternalLink } from 'lucide-react';
import type { ScanReport, GeneratedTicket } from '@/lib/health/types';

interface DrawerTicketsProps {
  report: ScanReport;
  projectId: number;
}

function getTickets(report: ScanReport): GeneratedTicket[] {
  if ('generatedTickets' in report) {
    return report.generatedTickets;
  }
  return [];
}

const STAGE_COLORS: Record<string, string> = {
  INBOX: 'text-muted-foreground bg-muted',
  SPECIFY: 'text-ctp-blue bg-ctp-blue/10',
  PLAN: 'text-ctp-blue bg-ctp-blue/10',
  BUILD: 'text-ctp-yellow bg-ctp-yellow/10',
  VERIFY: 'text-ctp-peach bg-ctp-peach/10',
  SHIP: 'text-ctp-green bg-ctp-green/10',
};

export function DrawerTickets({ report, projectId }: DrawerTicketsProps) {
  const tickets = getTickets(report);

  if (tickets.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground">Generated Tickets</h4>
      <div className="space-y-1.5">
        {tickets.map((ticket) => {
          const stageColor = STAGE_COLORS[ticket.stage] ?? 'text-muted-foreground bg-muted';
          return (
            <a
              key={ticket.ticketKey}
              href={`/projects/${projectId}/board?ticket=${ticket.ticketKey}`}
              className="flex items-center justify-between aurora-glass rounded-md px-3 py-2 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-foreground">{ticket.ticketKey}</span>
                <span className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${stageColor}`}>
                  {ticket.stage}
                </span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

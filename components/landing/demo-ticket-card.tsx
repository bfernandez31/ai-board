/**
 * Demo Ticket Card Component
 * Displays individual ticket card in the mini-Kanban demo
 * Matches actual board ticket card dark theme styling
 */

'use client';

import { Card } from '@/components/ui/card';
import type { DemoTicket } from '@/lib/utils/animation-helpers';

export interface DemoTicketCardProps {
  ticket: DemoTicket;
  isAnimating?: boolean;
  prefersReducedMotion?: boolean;
}

/**
 * Demo ticket card matching actual board dark theme styling
 *
 * @param ticket - Ticket data to display
 * @param isAnimating - True during column transition
 * @param prefersReducedMotion - True if user prefers reduced motion
 */
export function DemoTicketCard({
  ticket,
  isAnimating = false,
  prefersReducedMotion = false,
}: DemoTicketCardProps) {
  return (
    <Card
      className={`
        demo-ticket
        bg-[#181825]
        border-[#313244]
        p-4
        transition-all
        hover:border-[#45475a]
        hover:bg-[#1e1e2e]
        overflow-hidden
        shadow-sm
        cursor-grab
        active:cursor-grabbing
        ${prefersReducedMotion ? 'duration-300' : 'duration-200'}
      `}
      data-ticket-id={ticket.id}
      data-column={ticket.column}
      data-animating={isAnimating}
      role="article"
      aria-label={`Demo ticket: ${ticket.title}`}
    >
      {/* Header: Ticket ID */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-[#a6adc8] font-mono font-semibold">
          #{ticket.id}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm line-clamp-2 text-[#cdd6f4] break-words overflow-hidden">
        {ticket.title}
      </h3>
    </Card>
  );
}

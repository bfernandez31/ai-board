/**
 * Demo Ticket Card Component
 * Displays individual ticket card in the mini-Kanban demo
 */

'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import type { DemoTicket } from '@/lib/utils/animation-helpers';

export interface DemoTicketCardProps {
  ticket: DemoTicket;
  isAnimating?: boolean;
  prefersReducedMotion?: boolean;
}

/**
 * Demo ticket card with hover affordance and smooth transitions
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
        p-3
        bg-white
        shadow-sm
        hover:shadow-lg
        rounded-lg
        cursor-grab
        active:cursor-grabbing
        transition-all
        ${prefersReducedMotion ? 'duration-300' : 'duration-200'}
        ${!prefersReducedMotion ? 'hover:-translate-y-0.5' : ''}
      `}
      data-ticket-id={ticket.id}
      data-column={ticket.column}
      data-animating={isAnimating}
    >
      <div className="text-sm font-medium text-gray-900 line-clamp-2">
        {ticket.title}
      </div>
    </Card>
  );
}

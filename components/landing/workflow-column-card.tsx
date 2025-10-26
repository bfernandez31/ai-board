/**
 * Workflow Column Card Component
 * Displays one of the 6 workflow stages (INBOX → SHIP)
 */

'use client';

import React from 'react';
import { DemoTicketCard } from './demo-ticket-card';
import type { WorkflowStage, DemoTicket } from '@/lib/utils/animation-helpers';

export interface WorkflowColumnCardProps {
  stage: WorkflowStage;
  tickets: DemoTicket[];
  prefersReducedMotion?: boolean;
}

/**
 * Workflow column component displaying stage name and tickets
 *
 * @param stage - Column configuration (name, color, etc.)
 * @param tickets - Tickets currently in this column
 * @param prefersReducedMotion - True if user prefers reduced motion
 */
export function WorkflowColumnCard({
  stage,
  tickets,
  prefersReducedMotion = false,
}: WorkflowColumnCardProps) {
  return (
    <div
      className={`
        workflow-column
        ${stage.color}
        border
        border-gray-200
        rounded-lg
        p-4
        min-h-[200px]
        flex
        flex-col
        gap-3
      `}
      data-column-index={stage.index}
      data-column-name={stage.name}
    >
      {/* Column Header */}
      <div className="text-sm font-medium text-gray-700 uppercase tracking-wide">
        {stage.label}
      </div>

      {/* Tickets in this column */}
      <div className="flex flex-col gap-2">
        {tickets.map((ticket) => (
          <DemoTicketCard
            key={ticket.id}
            ticket={ticket}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}
      </div>
    </div>
  );
}

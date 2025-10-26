/**
 * Workflow Column Card Component
 * Displays one of the 6 workflow stages (INBOX → SHIP)
 * Matches actual board dark theme styling
 */

'use client';

import React, { useState } from 'react';
import { DemoTicketCard } from './demo-ticket-card';
import type { WorkflowStage, DemoTicket } from '@/lib/utils/animation-helpers';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface WorkflowColumnCardProps {
  stage: WorkflowStage;
  tickets: DemoTicket[];
  prefersReducedMotion?: boolean;
}

// Stage descriptions for tooltips
const STAGE_DESCRIPTIONS: Record<string, string> = {
  INBOX: 'New ideas and feature requests start here',
  SPECIFY: 'Define requirements and create detailed specifications',
  PLAN: 'Design architecture and create implementation plan',
  BUILD: 'Implement the feature with AI assistance',
  VERIFY: 'Test and validate the implementation',
  SHIP: 'Deploy to production and close the ticket',
};

/**
 * Workflow column component displaying stage name and tickets
 * Matches actual board dark theme styling with tooltips
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
  const [isHovered, setIsHovered] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={isHovered}>
        <TooltipTrigger asChild>
          <div
            className={`
              workflow-column
              flex flex-col h-full min-h-[280px] rounded-lg border overflow-hidden
              shadow-[0_0_24px_rgba(0,0,0,0.35)]
              transition-all duration-300
              ${stage.bgColor}
              ${stage.borderColor}
            `}
            data-column-index={stage.index}
            data-column-name={stage.name}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Column Header */}
            <div
              className={`${stage.headerBgColor} border-b ${stage.headerBorderColor} px-4 py-2.5`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2
                  className={`text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${stage.textColor}`}
                >
                  {stage.label}
                </h2>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.58rem] font-semibold shadow-[0_0_8px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/10 ${stage.badgeBgColor} ${stage.badgeTextColor}`}
                >
                  {tickets.length}
                </span>
              </div>
            </div>

            {/* Tickets */}
            <div className="flex-1 space-y-3 px-4 pb-5 pt-3">
              {tickets.map((ticket) => (
                <DemoTicketCard
                  key={ticket.id}
                  ticket={ticket}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ))}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-[#1e1e2e] border-[#313244] text-[#cdd6f4] max-w-[200px]"
        >
          <p className="text-sm">{STAGE_DESCRIPTIONS[stage.name]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

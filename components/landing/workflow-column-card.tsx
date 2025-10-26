/**
 * Workflow Column Card Component
 * Displays one of the 6 workflow stages (INBOX → SHIP)
 * Beautiful hover effects with elevation and purple tooltips
 */

'use client';

import React, { useState } from 'react';
import { DemoTicketCard } from './demo-ticket-card';
import type { WorkflowStage, DemoTicket } from '@/lib/utils/animation-helpers';

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
 * Workflow column with beautiful hover effects
 * - Elevation: Column lifts up slightly on hover
 * - Overlay: Other columns dim with dark overlay
 * - Tooltip: Purple-themed tooltip with stage description
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
    <div className="relative group">
      {/* Column Card */}
      <div
        className={`
          workflow-column
          flex flex-col h-full min-h-[280px] rounded-lg border overflow-hidden
          shadow-[0_0_24px_rgba(0,0,0,0.35)]
          transition-all duration-300 ease-out
          ${stage.bgColor}
          ${stage.borderColor}
          group-hover:scale-105
          group-hover:shadow-[0_0_40px_rgba(137,180,250,0.3)]
          group-hover:z-10
          ${!prefersReducedMotion ? 'group-hover:-translate-y-1' : ''}
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

      {/* Beautiful Purple Tooltip */}
      {isHovered && (
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="relative">
            {/* Arrow pointing up */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-[#89b4fa]"></div>

            {/* Tooltip content */}
            <div className="bg-[#89b4fa] text-white px-4 py-2.5 rounded-lg shadow-lg shadow-[#89b4fa]/30 min-w-[200px] max-w-[280px]">
              <p className="text-sm font-medium text-center leading-relaxed">
                {STAGE_DESCRIPTIONS[stage.name]}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Stage } from '@/lib/stage-validation';
import { TicketCard } from './ticket-card';
import { NewTicketButton } from './new-ticket-button';
import { TicketWithVersion } from '@/lib/types';

interface StageColumnProps {
  stage: Stage;
  tickets: TicketWithVersion[];
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
  projectId: number;
}

// Stage configuration matching original design
const STAGE_CONFIG: Record<
  Stage,
  {
    label: string;
    color: string;
    bgColor: string;
    headerBgColor: string;
    headerBorderColor: string;
    textColor: string;
    borderColor: string;
    badgeBgColor: string;
    badgeTextColor: string;
    order: number;
  }
> = {
  [Stage.INBOX]: {
    label: 'INBOX',
    color: 'gray',
    bgColor: 'bg-zinc-950/80',
    headerBgColor: 'bg-zinc-900/80',
    headerBorderColor: 'border-zinc-800/40',
    textColor: 'text-zinc-100',
    borderColor: 'border-zinc-800/40',
    badgeBgColor: 'bg-zinc-800/70',
    badgeTextColor: 'text-zinc-50',
    order: 0,
  },
  [Stage.SPECIFY]: {
    label: 'SPECIFY',
    color: 'yellow',
    bgColor: 'bg-yellow-950/40',
    headerBgColor: 'bg-yellow-950/60',
    headerBorderColor: 'border-yellow-900/40',
    textColor: 'text-yellow-100',
    borderColor: 'border-yellow-950/40',
    badgeBgColor: 'bg-yellow-800/70',
    badgeTextColor: 'text-yellow-50',
    order: 1,
  },
  [Stage.PLAN]: {
    label: 'PLAN',
    color: 'blue',
    bgColor: 'bg-blue-950/40',
    headerBgColor: 'bg-blue-950/60',
    headerBorderColor: 'border-blue-900/40',
    textColor: 'text-blue-100',
    borderColor: 'border-blue-950/40',
    badgeBgColor: 'bg-blue-800/70',
    badgeTextColor: 'text-blue-100',
    order: 2,
  },
  [Stage.BUILD]: {
    label: 'BUILD',
    color: 'green',
    bgColor: 'bg-emerald-950/40',
    headerBgColor: 'bg-emerald-950/60',
    headerBorderColor: 'border-emerald-900/40',
    textColor: 'text-emerald-100',
    borderColor: 'border-emerald-950/40',
    badgeBgColor: 'bg-emerald-800/70',
    badgeTextColor: 'text-emerald-50',
    order: 3,
  },
  [Stage.VERIFY]: {
    label: 'VERIFY',
    color: 'orange',
    bgColor: 'bg-orange-950/40',
    headerBgColor: 'bg-orange-950/60',
    headerBorderColor: 'border-orange-900/40',
    textColor: 'text-orange-100',
    borderColor: 'border-orange-950/40',
    badgeBgColor: 'bg-orange-800/70',
    badgeTextColor: 'text-orange-50',
    order: 4,
  },
  [Stage.SHIP]: {
    label: 'SHIP',
    color: 'purple',
    bgColor: 'bg-purple-950/40',
    headerBgColor: 'bg-purple-950/60',
    headerBorderColor: 'border-purple-900/40',
    textColor: 'text-purple-100',
    borderColor: 'border-purple-950/40',
    badgeBgColor: 'bg-purple-800/70',
    badgeTextColor: 'text-purple-50',
    order: 5,
  },
};

/**
 * StageColumn Component - Original Design with Drag-and-Drop
 */
export const StageColumn = React.memo(
  ({
    stage,
    tickets,
    isDraggable = true,
    onTicketClick,
    projectId,
  }: StageColumnProps) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `droppable-${stage}`,
      data: {
        stage,
        type: 'column',
      },
    });

    const stageConfig = STAGE_CONFIG[stage];
    const ticketCount = tickets.length;
    const showNewTicketButton = stageConfig.order === 0; // Only show in INBOX

    return (
      <div
        ref={setNodeRef}
        data-testid={`column-${stage}`}
        data-column={stage}
        data-stage={stage}
        className={`flex flex-col h-full min-w-[280px] rounded-lg border overflow-hidden shadow-[0_0_24px_rgba(0,0,0,0.35)] transition-all duration-300 ${stageConfig.bgColor} ${stageConfig.borderColor} ${
          isOver ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-black' : ''
        }`}
      >
        {/* Column Header */}
        <div
          className={`${stageConfig.headerBgColor} border-b ${stageConfig.headerBorderColor} px-4 py-2.5`}
        >
          <div className="flex items-center justify-between gap-3">
            {/* Stage name */}
            <h2
              className={`text-[0.65rem] font-semibold uppercase tracking-[0.28em] ${stageConfig.textColor}`}
            >
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
            {/* New Ticket Button - Only in INBOX */}
            {showNewTicketButton && (
              <NewTicketButton stage={stage} projectId={projectId} />
            )}

            {/* Ticket Cards */}
            {tickets.length > 0 ? (
              tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  isDraggable={isDraggable}
                  {...(onTicketClick && { onTicketClick })}
                />
              ))
            ) : (
              <div className="text-center text-sm text-zinc-400/90 py-12 font-medium">
                No tickets
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Drop Zone Visual Feedback */}
        {isOver && (
          <div className="absolute inset-0 border-4 border-dashed border-blue-500 rounded-lg pointer-events-none bg-blue-500/10" />
        )}
      </div>
    );
  }
);

StageColumn.displayName = 'StageColumn';

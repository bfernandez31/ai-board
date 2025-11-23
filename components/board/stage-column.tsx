'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Stage } from '@/lib/stage-transitions';
import { TicketCard } from './ticket-card';
import { NewTicketButton } from './new-ticket-button';
import { MobileScrollButton } from './mobile-scroll-button';
import { TicketWithVersion } from '@/lib/types';
import { Job } from '@prisma/client';
import { Ban } from 'lucide-react';
import type { DualJobState } from '@/lib/types/job-types';

interface StageColumnProps {
  stage: Stage;
  tickets: TicketWithVersion[];
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
  projectId: number;
  getTicketJob?: (ticketId: number) => Job | null;
  getTicketJobs?: (ticketId: number) => DualJobState;
  dropZoneStyle?: string;
  isBlockedByJob?: boolean;
  // AIB-72: Reason why transitions are blocked ('job' for ticket job, 'cleanup' for project cleanup)
  blockReason?: 'job' | 'cleanup';
  activePreviewTicket?: { ticketKey: string } | null;
  activeDeploymentTicket?: number | null;
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
    bgColor: 'bg-[#6c7086]/10',
    headerBgColor: 'bg-[#6c7086]/30',
    headerBorderColor: 'border-[#6c7086]/40',
    textColor: 'text-zinc-100',
    borderColor: 'border-[#6c7086]/40',
    badgeBgColor: 'bg-[#6c7086]/70',
    badgeTextColor: 'text-zinc-50',
    order: 0,
  },
  [Stage.SPECIFY]: {
    label: 'SPECIFY',
    color: 'mauve',
    bgColor: 'bg-[#b4befe]/10',
    headerBgColor: 'bg-[#b4befe]/30',
    headerBorderColor: 'border-[#b4befe]/40',
    textColor: 'text-[#b4befe]',
    borderColor: 'border-[#b4befe]/40',
    badgeBgColor: 'bg-[#b4befe]/70',
    badgeTextColor: 'text-zinc-50',
    order: 1,
  },
  [Stage.PLAN]: {
    label: 'PLAN',
    color: 'blue',
    bgColor: 'bg-[#89b4fa]/10',
    headerBgColor: 'bg-[#89b4fa]/30',
    headerBorderColor: 'border-[#89b4fa]/40',
    textColor: 'text-[#89b4fa]',
    borderColor: 'border-[#89b4fa]/40',
    badgeBgColor: 'bg-[#89b4fa]/70',
    badgeTextColor: 'text-zinc-50',
    order: 2,
  },
  [Stage.BUILD]: {
    label: 'BUILD',
    color: 'peach',
    bgColor: 'bg-[#f9cb98]/10',
    headerBgColor: 'bg-[#f9cb98]/30',
    headerBorderColor: 'border-[#f9cb98]/40',
    textColor: 'text-[#f9cb98]',
    borderColor: 'border-[#f9cb98]/40',
    badgeBgColor: 'bg-[#f9cb98]/70',
    badgeTextColor: 'text-zinc-50',
    order: 3,
  },
  [Stage.VERIFY]: {
    label: 'VERIFY',
    color: 'pink',
    bgColor: 'bg-[#f2cdcd]/10',
    headerBgColor: 'bg-[#f2cdcd]/30',
    headerBorderColor: 'border-[#f2cdcd]/40',
    textColor: 'text-[#f2cdcd]',
    borderColor: 'border-[#f2cdcd]/40',
    badgeBgColor: 'bg-[#f2cdcd]/70',
    badgeTextColor: 'text-zinc-50',
    order: 4,
  },
  [Stage.SHIP]: {
    label: 'SHIP',
    color: 'green',
    bgColor: 'bg-[#a6e3a1]/10',
    headerBgColor: 'bg-[#a6e3a1]/30',
    headerBorderColor: 'border-[#a6e3a1]/40',
    textColor: 'text-[#a6e3a1]',
    borderColor: 'border-[#a6e3a1]/40',
    badgeBgColor: 'bg-[#a6e3a1]/70',
    badgeTextColor: 'text-zinc-50',
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
    getTicketJob,
    getTicketJobs,
    dropZoneStyle,
    isBlockedByJob = false,
    blockReason = 'job',
    activePreviewTicket,
    activeDeploymentTicket,
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

    // Scroll detection state for mobile scroll buttons
    const [canScrollUp, setCanScrollUp] = React.useState(false);
    const [canScrollDown, setCanScrollDown] = React.useState(false);
    const scrollViewportRef = React.useRef<HTMLDivElement>(null);

    // Check scroll position to determine button visibility
    const checkScrollPosition = React.useCallback(() => {
      const viewport = scrollViewportRef.current;
      if (!viewport) return;

      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const scrollThreshold = 10; // Small threshold to account for rounding

      setCanScrollUp(scrollTop > scrollThreshold);
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - scrollThreshold);
    }, []);

    // Handle scroll button clicks
    const handleScrollUp = React.useCallback(() => {
      const viewport = scrollViewportRef.current;
      if (!viewport) return;

      viewport.scrollBy({
        top: -200, // Scroll up by 200px
        behavior: 'smooth',
      });
    }, []);

    const handleScrollDown = React.useCallback(() => {
      const viewport = scrollViewportRef.current;
      if (!viewport) return;

      viewport.scrollBy({
        top: 200, // Scroll down by 200px
        behavior: 'smooth',
      });
    }, []);

    // Check scroll position on mount and when tickets change
    React.useEffect(() => {
      checkScrollPosition();
    }, [tickets, checkScrollPosition]);

    // Set up scroll event listener
    React.useEffect(() => {
      const viewport = scrollViewportRef.current;
      if (!viewport) return;

      viewport.addEventListener('scroll', checkScrollPosition);
      return () => {
        viewport.removeEventListener('scroll', checkScrollPosition);
      };
    }, [checkScrollPosition]);

    return (
      <div
        ref={setNodeRef}
        data-testid={`column-${stage}`}
        data-column={stage}
        data-stage={stage}
        className={`flex flex-col h-full min-w-[280px] rounded-lg border overflow-hidden shadow-[0_0_24px_rgba(0,0,0,0.35)] transition-all duration-300 relative ${stageConfig.bgColor} ${stageConfig.borderColor} ${dropZoneStyle || ''} ${
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
        <ScrollArea className="flex-1 overscroll-none" viewportRef={scrollViewportRef}>
          <div className="space-y-3 px-4 pb-5 pt-3 touch-pan-y">
            {/* New Ticket Button - Only in INBOX */}
            {showNewTicketButton && (
              <NewTicketButton stage={stage} projectId={projectId} />
            )}

            {/* Ticket Cards */}
            {tickets.length > 0 ? (
              tickets.map((ticket) => {
                const dualJobs = getTicketJobs?.(ticket.id);
                return (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    currentJob={getTicketJob?.(ticket.id) || null}
                    workflowJob={dualJobs?.workflow || null}
                    aiBoardJob={dualJobs?.aiBoard || null}
                    deployJob={dualJobs?.deployJob || null}
                    isDraggable={isDraggable}
                    activePreviewTicket={activePreviewTicket || null}
                    activeDeploymentTicket={activeDeploymentTicket || null}
                    {...(onTicketClick && { onTicketClick })}
                  />
                );
              })
            ) : (
              <div className="text-center text-sm text-zinc-400/90 py-12 font-medium">
                No tickets
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Mobile Scroll Buttons */}
        <MobileScrollButton
          direction="up"
          onClick={handleScrollUp}
          visible={canScrollUp}
        />
        <MobileScrollButton
          direction="down"
          onClick={handleScrollDown}
          visible={canScrollDown}
        />

        {/* Blocked by Job or Cleanup Overlay */}
        {isBlockedByJob && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 pointer-events-none">
            <Ban className="w-16 h-16 text-red-400 mb-3" strokeWidth={2.5} />
            {blockReason === 'cleanup' ? (
              <>
                <p className="text-red-300 font-semibold text-sm">Cleanup in progress</p>
                <p className="text-zinc-400 text-xs mt-1">Wait for cleanup completion</p>
              </>
            ) : (
              <>
                <p className="text-red-300 font-semibold text-sm">Workflow in progress</p>
                <p className="text-zinc-400 text-xs mt-1">Wait for job completion</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  }
);

StageColumn.displayName = 'StageColumn';

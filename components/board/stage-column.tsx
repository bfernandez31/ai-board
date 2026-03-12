'use client';

import * as React from 'react';

import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Stage } from '@/lib/stage-transitions';
import { TicketCard } from './ticket-card';
import { NewTicketButton } from './new-ticket-button';
import { MobileScrollButton } from './mobile-scroll-button';
import { TicketWithVersion } from '@/lib/types';
import { Ban } from 'lucide-react';
import type { DualJobState } from '@/lib/types/job-types';

interface StageColumnProps {
  stage: Stage;
  tickets: TicketWithVersion[];
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
  projectId: number;
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
    bgColor: 'bg-ctp-overlay0/10',
    headerBgColor: 'bg-ctp-overlay0/30',
    headerBorderColor: 'border-ctp-overlay0/40',
    textColor: 'text-zinc-100',
    borderColor: 'border-ctp-overlay0/40',
    badgeBgColor: 'bg-ctp-overlay0/70',
    badgeTextColor: 'text-zinc-50',
    order: 0,
  },
  [Stage.SPECIFY]: {
    label: 'SPECIFY',
    color: 'mauve',
    bgColor: 'bg-ctp-lavender/10',
    headerBgColor: 'bg-ctp-lavender/30',
    headerBorderColor: 'border-ctp-lavender/40',
    textColor: 'text-ctp-lavender',
    borderColor: 'border-ctp-lavender/40',
    badgeBgColor: 'bg-ctp-lavender/70',
    badgeTextColor: 'text-zinc-50',
    order: 1,
  },
  [Stage.PLAN]: {
    label: 'PLAN',
    color: 'blue',
    bgColor: 'bg-ctp-blue/10',
    headerBgColor: 'bg-ctp-blue/30',
    headerBorderColor: 'border-ctp-blue/40',
    textColor: 'text-ctp-blue',
    borderColor: 'border-ctp-blue/40',
    badgeBgColor: 'bg-ctp-blue/70',
    badgeTextColor: 'text-zinc-50',
    order: 2,
  },
  [Stage.BUILD]: {
    label: 'BUILD',
    color: 'peach',
    bgColor: 'bg-ctp-peach-light/10',
    headerBgColor: 'bg-ctp-peach-light/30',
    headerBorderColor: 'border-ctp-peach-light/40',
    textColor: 'text-ctp-peach-light',
    borderColor: 'border-ctp-peach-light/40',
    badgeBgColor: 'bg-ctp-peach-light/70',
    badgeTextColor: 'text-zinc-50',
    order: 3,
  },
  [Stage.VERIFY]: {
    label: 'VERIFY',
    color: 'pink',
    bgColor: 'bg-ctp-flamingo/10',
    headerBgColor: 'bg-ctp-flamingo/30',
    headerBorderColor: 'border-ctp-flamingo/40',
    textColor: 'text-ctp-flamingo',
    borderColor: 'border-ctp-flamingo/40',
    badgeBgColor: 'bg-ctp-flamingo/70',
    badgeTextColor: 'text-zinc-50',
    order: 4,
  },
  [Stage.SHIP]: {
    label: 'SHIP',
    color: 'green',
    bgColor: 'bg-ctp-green/10',
    headerBgColor: 'bg-ctp-green/30',
    headerBorderColor: 'border-ctp-green/40',
    textColor: 'text-ctp-green',
    borderColor: 'border-ctp-green/40',
    badgeBgColor: 'bg-ctp-green/70',
    badgeTextColor: 'text-zinc-50',
    order: 5,
  },
  [Stage.CLOSED]: {
    label: 'CLOSED',
    color: 'gray',
    bgColor: 'bg-accent/10',
    headerBgColor: 'bg-accent/30',
    headerBorderColor: 'border-accent/40',
    textColor: 'text-accent',
    borderColor: 'border-accent/40',
    badgeBgColor: 'bg-accent/70',
    badgeTextColor: 'text-zinc-50',
    order: 6,
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

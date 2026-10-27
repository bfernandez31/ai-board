'use client';

import * as React from 'react';

import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Stage } from '@/lib/stage-transitions';
import { TicketCard, type TicketCardSelection } from './ticket-card';
import { NewTicketButton } from './new-ticket-button';
import { MobileScrollButton } from './mobile-scroll-button';
import { TicketWithVersion } from '@/lib/types';
import { Ban, Inbox, Loader2 } from 'lucide-react';
import type { DualJobState } from '@/lib/types/job-types';

export interface BulkSelectionContext {
  selectedIds: Set<number>;
  isSelectMode: boolean;
  toggle: (id: number) => void;
  rangeSelectTo: (id: number, allInboxIdsSorted: number[]) => void;
}

interface StageColumnProps {
  stage: Stage;
  tickets: TicketWithVersion[];
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
  projectId: number;
  getTicketJobs?: (ticketId: number) => DualJobState;
  dropZoneStyle?: string;
  isBlockedByJob?: boolean;
  activePreviewTicket?: { ticketKey: string } | null;
  activeDeploymentTicket?: number | null;
  totalCount?: number; // Total tickets for this stage (for pagination)
  onLoadMore?: () => void; // Callback to load more tickets
  isLoadingMore?: boolean; // Whether more tickets are being loaded
  loadMoreError?: boolean; // Whether the last load-more request failed
  /** Bulk-selection context, only honored when stage === 'INBOX' (AIB-821) */
  bulkSelection?: BulkSelectionContext;
}

// Stage configuration matching original design
const STAGE_CONFIG: Record<
  Stage,
  {
    label: string;
    bgColor: string;
    headerBgColor: string;
    headerBorderColor: string;
    headerGlow: string;
    textColor: string;
    borderColor: string;
    badgeBgColor: string;
    badgeTextColor: string;
    order: number;
  }
> = {
  [Stage.INBOX]: {
    label: 'INBOX',
    bgColor: 'bg-ctp-overlay0/10',
    headerBgColor: 'bg-ctp-overlay0/30',
    headerBorderColor: 'border-ctp-overlay0/40',
    headerGlow: 'shadow-[0_2px_12px_hsl(var(--ctp-overlay-0)/0.08)]',
    textColor: 'text-zinc-100',
    borderColor: 'border-ctp-overlay0/40',
    badgeBgColor: 'bg-ctp-overlay0/70',
    badgeTextColor: 'text-zinc-50',
    order: 0,
  },
  [Stage.SPECIFY]: {
    label: 'SPECIFY',
    bgColor: 'bg-ctp-lavender/10',
    headerBgColor: 'bg-ctp-lavender/30',
    headerBorderColor: 'border-ctp-lavender/40',
    headerGlow: 'shadow-[0_2px_12px_hsl(var(--ctp-lavender)/0.12)]',
    textColor: 'text-zinc-100',
    borderColor: 'border-ctp-lavender/40',
    badgeBgColor: 'bg-ctp-lavender/70',
    badgeTextColor: 'text-zinc-950',
    order: 1,
  },
  [Stage.PLAN]: {
    label: 'PLAN',
    bgColor: 'bg-ctp-blue/10',
    headerBgColor: 'bg-ctp-blue/30',
    headerBorderColor: 'border-ctp-blue/40',
    headerGlow: 'shadow-[0_2px_12px_hsl(var(--ctp-blue)/0.12)]',
    textColor: 'text-zinc-100',
    borderColor: 'border-ctp-blue/40',
    badgeBgColor: 'bg-ctp-blue/70',
    badgeTextColor: 'text-zinc-950',
    order: 2,
  },
  [Stage.BUILD]: {
    label: 'BUILD',
    bgColor: 'bg-ctp-peach-light/10',
    headerBgColor: 'bg-ctp-peach-light/30',
    headerBorderColor: 'border-ctp-peach-light/40',
    headerGlow: 'shadow-[0_2px_12px_hsl(var(--ctp-peach-light)/0.12)]',
    textColor: 'text-zinc-100',
    borderColor: 'border-ctp-peach-light/40',
    badgeBgColor: 'bg-ctp-peach-light/70',
    badgeTextColor: 'text-zinc-950',
    order: 3,
  },
  [Stage.VERIFY]: {
    label: 'VERIFY',
    bgColor: 'bg-ctp-flamingo/10',
    headerBgColor: 'bg-ctp-flamingo/30',
    headerBorderColor: 'border-ctp-flamingo/40',
    headerGlow: 'shadow-[0_2px_12px_hsl(var(--ctp-flamingo)/0.12)]',
    textColor: 'text-zinc-100',
    borderColor: 'border-ctp-flamingo/40',
    badgeBgColor: 'bg-ctp-flamingo/70',
    badgeTextColor: 'text-zinc-950',
    order: 4,
  },
  [Stage.SHIP]: {
    label: 'SHIP',
    bgColor: 'bg-ctp-green/10',
    headerBgColor: 'bg-ctp-green/30',
    headerBorderColor: 'border-ctp-green/40',
    headerGlow: 'shadow-[0_2px_12px_hsl(var(--ctp-green)/0.12)]',
    textColor: 'text-zinc-100',
    borderColor: 'border-ctp-green/40',
    badgeBgColor: 'bg-ctp-green/70',
    badgeTextColor: 'text-zinc-950',
    order: 5,
  },
  [Stage.CLOSED]: {
    label: 'CLOSED',
    bgColor: 'bg-accent/10',
    headerBgColor: 'bg-accent/30',
    headerBorderColor: 'border-accent/40',
    headerGlow: 'shadow-[0_2px_12px_hsl(var(--ctp-overlay-0)/0.08)]',
    textColor: 'text-zinc-100',
    borderColor: 'border-accent/40',
    badgeBgColor: 'bg-accent/70',
    badgeTextColor: 'text-zinc-950',
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
    activePreviewTicket,
    activeDeploymentTicket,
    totalCount,
    onLoadMore,
    isLoadingMore = false,
    loadMoreError = false,
    bulkSelection,
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
    const isInbox = stage === Stage.INBOX;

    const inboxIdsSorted = React.useMemo(
      () =>
        isInbox && bulkSelection
          ? [...tickets].sort((a, b) => a.ticketNumber - b.ticketNumber).map((t) => t.id)
          : [],
      [isInbox, bulkSelection, tickets]
    );

    // Scroll detection state for mobile scroll buttons
    const [canScrollUp, setCanScrollUp] = React.useState(false);
    const [canScrollDown, setCanScrollDown] = React.useState(false);
    const scrollViewportRef = React.useRef<HTMLDivElement>(null);
    const sentinelRef = React.useRef<HTMLDivElement>(null);

    // Infinite scroll: load next batch when the sentinel nears the viewport bottom
    React.useEffect(() => {
      const sentinel = sentinelRef.current;
      if (!onLoadMore || !sentinel || typeof IntersectionObserver === 'undefined') return;

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting) && !isLoadingMore && !loadMoreError) {
            onLoadMore();
          }
        },
        { root: scrollViewportRef.current, rootMargin: '0px 0px 100% 0px' }
      );
      observer.observe(sentinel);
      return () => observer.disconnect();
    }, [onLoadMore, isLoadingMore, loadMoreError, tickets.length]);

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
        className={`flex flex-col h-full min-w-[280px] rounded-lg border overflow-hidden shadow-[0_0_24px_hsl(var(--ctp-crust)/0.5)] transition-all duration-300 relative ${stageConfig.bgColor} ${stageConfig.borderColor} ${dropZoneStyle || ''} ${
          isOver ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
        }`}
      >
        {/* Column Header */}
        <div
          className={`${stageConfig.headerBgColor} border-b ${stageConfig.headerBorderColor} ${stageConfig.headerGlow} px-4 py-2.5`}
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
              className={`flex h-6 min-w-6 px-1.5 items-center justify-center rounded-full text-[0.58rem] font-semibold shadow-[0_0_8px_hsl(var(--ctp-crust)/0.5)] ring-1 ring-inset ring-border/20 ${stageConfig.badgeBgColor} ${stageConfig.badgeTextColor}`}
            >
              {totalCount !== undefined && totalCount > ticketCount
                ? `${ticketCount}/${totalCount}`
                : ticketCount}
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
              <>
                {tickets.map((ticket) => {
                  const dualJobs = getTicketJobs?.(ticket.id);
                  const selection: TicketCardSelection | undefined =
                    isInbox && bulkSelection
                      ? {
                          isSelected: bulkSelection.selectedIds.has(ticket.id),
                          isSelectMode: bulkSelection.isSelectMode,
                          onToggle: () => bulkSelection.toggle(ticket.id),
                          onRangeSelect: () =>
                            bulkSelection.rangeSelectTo(ticket.id, inboxIdsSorted),
                        }
                      : undefined;
                  return (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      workflowJob={dualJobs?.workflow || null}
                      aiBoardJob={dualJobs?.aiBoard || null}
                      deployJob={dualJobs?.deployJob || null}
                      qualityScore={ticket.qualityScore}
                      isDraggable={isDraggable}
                      activePreviewTicket={activePreviewTicket || null}
                      activeDeploymentTicket={activeDeploymentTicket || null}
                      {...(onTicketClick && { onTicketClick })}
                      {...(selection && { selection })}
                    />
                  );
                })}

                {/* Infinite scroll sentinel + footer for paginated stages */}
                {onLoadMore && (
                  <>
                    {!loadMoreError && (
                      <div
                        ref={sentinelRef}
                        data-testid="ship-load-sentinel"
                        aria-hidden="true"
                        className="h-px w-full"
                      />
                    )}
                    <div className="flex min-h-10 items-center justify-center">
                      {isLoadingMore && (
                        <div
                          role="status"
                          aria-label="Loading more tickets"
                          className="flex items-center text-muted-foreground"
                        >
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                      {loadMoreError && !isLoadingMore && (
                        <div role="alert" className="flex items-center gap-2 text-xs text-destructive">
                          <span>Couldn&apos;t load more tickets</span>
                          <Button variant="outline" size="sm" onClick={onLoadMore}>
                            Retry
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Inbox className="w-8 h-8 text-muted-foreground/30" strokeWidth={1.5} />
                <span className="text-sm text-muted-foreground font-medium">No tickets</span>
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

        {/* Blocked by Job Overlay */}
        {isBlockedByJob && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 pointer-events-none">
            <Ban className="w-16 h-16 text-destructive mb-3" strokeWidth={2.5} />
            <p className="text-destructive/80 font-semibold text-sm">Workflow in progress</p>
            <p className="text-muted-foreground text-xs mt-1">Wait for job completion</p>
          </div>
        )}
      </div>
    );
  }
);

StageColumn.displayName = 'StageColumn';

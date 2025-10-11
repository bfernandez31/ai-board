'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { StageColumn } from './stage-column';
import { DragOverlay } from './drag-overlay';
import { OfflineIndicator } from './offline-indicator';
import { TicketDetailModal } from './ticket-detail-modal';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Stage, isValidTransition, getAllStages } from '@/lib/stage-validation';
import { TicketWithVersion } from '@/lib/types';
import {
  updateTicketStageOptimistically,
  revertTicketStage,
} from '@/lib/optimistic-updates';
import { useToast } from '@/hooks/use-toast';
import { SSEProvider, useSSEContext } from './sse-provider';
import { Job } from '@prisma/client';

interface BoardProps {
  ticketsByStage: Record<Stage, TicketWithVersion[]>;
  projectId: number;
  initialJobs?: Map<number, Job>;
  /**
   * Enable SSE real-time updates (optional, defaults to true)
   * Set to false in test environments to avoid connection timeouts
   */
  sseEnabled?: boolean;
}

/**
 * BoardContent Component - Internal Board Logic
 *
 * Main kanban board with drag-and-drop functionality
 * - Optimistic UI updates
 * - Version-based conflict detection
 * - Sequential stage validation
 * - Touch and pointer support
 * - Project-scoped API calls
 * - Real-time job status updates
 */
function BoardContent({
  ticketsByStage: initialTicketsByStage,
  projectId,
  initialJobs = new Map(),
}: BoardProps) {
  const { jobUpdates } = useSSEContext();
  const [ticketsByStage, setTicketsByStage] = useState(initialTicketsByStage);
  const [activeTicket, setActiveTicket] = useState<TicketWithVersion | null>(
    null
  );
  const [selectedTicket, setSelectedTicket] =
    useState<TicketWithVersion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  // Sync with initialTicketsByStage only when new tickets are added
  // (e.g., from modal creation), but not during optimistic updates
  const prevTicketCountRef = React.useRef(
    Object.values(initialTicketsByStage).flat().length
  );

  React.useEffect(() => {
    const currentCount = Object.values(initialTicketsByStage).flat().length;
    const prevCount = prevTicketCountRef.current;

    // Only sync if ticket count increased (new ticket added)
    if (currentCount > prevCount) {
      setTicketsByStage(initialTicketsByStage);
      prevTicketCountRef.current = currentCount;
    }
  }, [initialTicketsByStage]);

  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // Long-press duration
        tolerance: 5, // Movement tolerance during delay
      },
    })
  );

  const groupTicketsByStage = useCallback(
    (tickets: TicketWithVersion[]): Record<Stage, TicketWithVersion[]> => {
      const grouped = getAllStages().reduce(
        (acc, stage) => {
          acc[stage] = [];
          return acc;
        },
        {} as Record<Stage, TicketWithVersion[]>
      );

      tickets.forEach((ticket) => {
        if (ticket.stage in grouped) {
          grouped[ticket.stage as Stage].push(ticket);
        }
      });

      return grouped;
    },
    []
  );

  // Get all tickets as a flat array for updates
  const allTickets = useMemo(() => {
    return Object.values(ticketsByStage).flat();
  }, [ticketsByStage]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const ticket = event.active.data.current?.ticket as TicketWithVersion;
    if (ticket) {
      setActiveTicket(ticket);
    }
  }, []);

  // Handle drag end with API call
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTicket(null);

      const { active, over } = event;

      if (!over || !isOnline) return;

      const ticket = active.data.current?.ticket as TicketWithVersion;
      const targetStage = over.data.current?.stage as Stage;

      if (!ticket || !targetStage || ticket.stage === targetStage) return;

      // Validate transition
      if (!isValidTransition(ticket.stage, targetStage)) {
        toast({
          variant: 'destructive',
          title: 'Invalid stage transition',
          description: `Cannot move from ${ticket.stage} to ${targetStage}. Tickets must progress sequentially.`,
        });
        return;
      }

      // Store original state for rollback
      const originalStage = ticket.stage;
      const originalVersion = ticket.version;

      // Optimistic update
      const updatedTickets = updateTicketStageOptimistically(
        allTickets,
        ticket.id,
        targetStage
      );
      setTicketsByStage(groupTicketsByStage(updatedTickets));

      // Send update to server (project-scoped API)
      try {
        const response = await fetch(
          `/api/projects/${projectId}/tickets/${ticket.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stage: targetStage,
              version: originalVersion,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();

          // Rollback optimistic update
          const revertedTickets = revertTicketStage(
            updatedTickets,
            ticket.id,
            originalStage,
            originalVersion
          );
          setTicketsByStage(groupTicketsByStage(revertedTickets));

          // Show error message
          if (response.status === 409) {
            toast({
              variant: 'destructive',
              title: 'Ticket modified by another user',
              description: 'Please refresh the page and try again.',
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Failed to update ticket',
              description:
                error.message || 'An error occurred while updating the ticket.',
            });
          }
        } else {
          // Success - merge server response with optimistic update
          const serverData = await response.json();

          const finalTickets = updatedTickets.map((t) =>
            t.id === ticket.id
              ? {
                  ...t,
                  stage: serverData.stage || t.stage,
                  version: serverData.version || t.version,
                  branch: serverData.branch !== undefined ? serverData.branch : t.branch,
                  updatedAt: serverData.updatedAt || t.updatedAt,
                }
              : t
          );
          setTicketsByStage(groupTicketsByStage(finalTickets));

          toast({
            title: 'Ticket updated',
            description: `Moved to ${targetStage}`,
          });
        }
      } catch (error) {
        console.error('Error updating ticket:', error);

        // Rollback on network error
        const revertedTickets = revertTicketStage(
          updatedTickets,
          ticket.id,
          originalStage,
          originalVersion
        );
        setTicketsByStage(groupTicketsByStage(revertedTickets));

        toast({
          variant: 'destructive',
          title: 'Network error',
          description: 'Could not update ticket. Please check your connection.',
        });
      }
    },
    [allTickets, groupTicketsByStage, isOnline, toast, projectId]
  );

  // Handle ticket click to open modal
  const handleTicketClick = useCallback((ticket: TicketWithVersion) => {
    setSelectedTicket(ticket);
    setIsModalOpen(true);
  }, []);

  // Handle modal close
  const handleModalClose = useCallback((open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setSelectedTicket(null);
    }
  }, []);

  // Handle ticket update from modal
  type UpdatedModalTicket = {
    id: number;
    title: string;
    description: string | null;
    stage: Stage | string;
    version: number;
    projectId: number;
    branch: string | null;
    autoMode: boolean;
    createdAt: string | Date;
    updatedAt: string | Date;
  };

  const handleTicketUpdate = useCallback(
    (updatedTicket?: UpdatedModalTicket) => {
      if (!updatedTicket) {
        return;
      }

      const normalizedTicket: TicketWithVersion = {
        id: updatedTicket.id,
        title: updatedTicket.title,
        description: updatedTicket.description,
        stage: updatedTicket.stage as Stage,
        version: updatedTicket.version,
        projectId: updatedTicket.projectId,
        branch: updatedTicket.branch,
        autoMode: updatedTicket.autoMode,
        createdAt:
          updatedTicket.createdAt instanceof Date
            ? updatedTicket.createdAt.toISOString()
            : updatedTicket.createdAt,
        updatedAt:
          updatedTicket.updatedAt instanceof Date
            ? updatedTicket.updatedAt.toISOString()
            : updatedTicket.updatedAt,
      };

      const ticketExists = allTickets.some(
        (ticket) => ticket.id === normalizedTicket.id
      );
      const updatedTickets = ticketExists
        ? allTickets.map((ticket) =>
            ticket.id === normalizedTicket.id ? normalizedTicket : ticket
          )
        : [...allTickets, normalizedTicket];

      setTicketsByStage(groupTicketsByStage(updatedTickets));
      setSelectedTicket(normalizedTicket);
    },
    [allTickets, groupTicketsByStage]
  );

  // Get job for a specific ticket (merges initial + live data)
  const getTicketJob = useCallback(
    (ticketId: number): Job | null => {
      // Prioritize real-time SSE update
      const liveUpdate = jobUpdates.get(ticketId);
      if (liveUpdate) {
        // Convert to Job-like object (SSE message has minimal fields)
        // We'll use the initial job as base if available, otherwise create minimal job
        const baseJob = initialJobs.get(ticketId);
        if (baseJob) {
          return {
            ...baseJob,
            status: liveUpdate.status,
            command: liveUpdate.command,
          };
        }

        // Create minimal Job object from SSE update (for new jobs created during session)
        return {
          id: liveUpdate.jobId,
          ticketId: liveUpdate.ticketId,
          status: liveUpdate.status,
          command: liveUpdate.command,
          startedAt: new Date(liveUpdate.timestamp),
          completedAt: null,
        } as Job;
      }

      // Fall back to initial job data
      return initialJobs.get(ticketId) || null;
    },
    [jobUpdates, initialJobs]
  );

  const stages = getAllStages();

  return (
    <>
      <OfflineIndicator />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full h-full bg-[#1e1e2e]">
          {/* Board Grid - Restored original styling */}
          <div
            data-testid="board-grid"
            className="grid gap-4 overflow-x-auto pb-6 px-4 pt-4"
            style={{
              gridTemplateColumns: 'repeat(6, minmax(300px, 1fr))',
              height: 'calc(100vh - 4rem - 4px)',
            }}
          >
            {stages.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                tickets={ticketsByStage[stage] || []}
                isDraggable={isOnline}
                onTicketClick={handleTicketClick}
                projectId={projectId}
                getTicketJob={getTicketJob}
              />
            ))}
          </div>
        </div>

        <DragOverlay activeTicket={activeTicket} />
      </DndContext>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        open={isModalOpen}
        onOpenChange={handleModalClose}
        onUpdate={handleTicketUpdate}
        projectId={projectId}
      />
    </>
  );
}

/**
 * Board Component - SSE-Enabled Board Wrapper
 *
 * Wraps BoardContent with SSEProvider for real-time updates.
 */
export function Board(props: BoardProps) {
  const { sseEnabled = true, ...contentProps } = props;

  return (
    <SSEProvider projectId={props.projectId} enabled={sseEnabled}>
      <BoardContent {...contentProps} />
    </SSEProvider>
  );
}

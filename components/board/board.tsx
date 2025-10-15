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
import { QuickImplModal } from './quick-impl-modal';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Stage, isValidTransition, getAllStages } from '@/lib/stage-validation';
import { TicketWithVersion } from '@/lib/types';
import {
  updateTicketStageOptimistically,
  revertTicketStage,
} from '@/lib/optimistic-updates';
import { useToast } from '@/hooks/use-toast';
import { useJobPolling } from '@/app/lib/hooks/useJobPolling';
import { Job, ClarificationPolicy } from '@prisma/client';

interface BoardProps {
  ticketsByStage: Record<Stage, TicketWithVersion[]>;
  projectId: number;
  initialJobs?: Map<number, Job>;
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
  // Poll for job status updates (replaces SSE)
  const { jobs: polledJobs } = useJobPolling(projectId, 2000);
  const [ticketsByStage, setTicketsByStage] = useState(initialTicketsByStage);
  const [activeTicket, setActiveTicket] = useState<TicketWithVersion | null>(
    null
  );
  const [selectedTicket, setSelectedTicket] =
    useState<TicketWithVersion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  // Drag state for visual feedback (T019)
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<Stage | null>(null);
  const [draggedTicketHasJob, setDraggedTicketHasJob] = useState(false);

  // Pending transition for quick-impl modal (T035)
  const [pendingTransition, setPendingTransition] = useState<{
    ticket: TicketWithVersion;
    targetStage: Stage;
  } | null>(null);

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

  // Get job for a specific ticket (merges initial + polled data)
  const getTicketJob = useCallback(
    (ticketId: number): Job | null => {
      // Prioritize real-time polled update
      const polledJob = polledJobs.find(job => job.ticketId === ticketId);
      if (polledJob) {
        // Convert polled job to Job type
        const baseJob = initialJobs.get(ticketId);
        if (baseJob) {
          return {
            ...baseJob,
            status: polledJob.status,
            updatedAt: new Date(polledJob.updatedAt),
          };
        }

        // Create minimal Job object from polled data (for new jobs created during session)
        return {
          id: polledJob.id,
          ticketId: polledJob.ticketId,
          status: polledJob.status,
          command: '', // Not included in polling response
          startedAt: new Date(polledJob.updatedAt),
          completedAt: null,
        } as Job;
      }

      // Fall back to initial job data
      return initialJobs.get(ticketId) || null;
    },
    [polledJobs, initialJobs]
  );

  // Handle drag start (T020 - Add drag state)
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const ticket = event.active.data.current?.ticket as TicketWithVersion;
    if (ticket) {
      setActiveTicket(ticket);
      setIsDragging(true);
      setDragSource(ticket.stage);

      // Check if ticket has a non-completed job
      const job = getTicketJob(ticket.id);
      const hasActiveJob = job && job.status !== 'COMPLETED';
      setDraggedTicketHasJob(!!hasActiveJob);
    }
  }, [getTicketJob]);

  // Handle drag end with API call
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveTicket(null);
      setIsDragging(false);
      setDragSource(null);
      setDraggedTicketHasJob(false);

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

      // T036: Detect INBOX → BUILD and show quick-impl modal
      if (ticket.stage === Stage.INBOX && targetStage === Stage.BUILD) {
        setPendingTransition({ ticket, targetStage });
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

          // Show error message with backend-provided details
          if (response.status === 409) {
            toast({
              variant: 'destructive',
              title: 'Ticket modified by another user',
              description: 'Please refresh the page and try again.',
            });
          } else if (response.status === 500 && error.error) {
            // Display server-provided error message directly
            toast({
              variant: 'destructive',
              title: 'Cannot move ticket',
              description: error.error,
            });
          } else {
            toast({
              variant: 'destructive',
              title: 'Failed to update ticket',
              description:
                error.error || error.message || 'An error occurred while updating the ticket.',
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
    clarificationPolicy: ClarificationPolicy | null;
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
        clarificationPolicy: updatedTicket.clarificationPolicy,
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

  // T037: Handle quick-impl confirmation
  const handleQuickImplConfirm = useCallback(async () => {
    if (!pendingTransition) return;

    const { ticket, targetStage } = pendingTransition;
    setPendingTransition(null);

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

    // Send update to server using transition endpoint
    try {
      const response = await fetch(
        `/api/projects/${projectId}/tickets/${ticket.id}/transition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetStage,
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
        toast({
          variant: 'destructive',
          title: 'Failed to start quick implementation',
          description:
            error.message || 'An error occurred while starting the workflow.',
        });
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
          title: 'Quick implementation started',
          description: `Workflow dispatched for ticket #${ticket.id}`,
        });
      }
    } catch (error) {
      console.error('Error starting quick-impl:', error);

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
        description: 'Could not start workflow. Please check your connection.',
      });
    }
  }, [pendingTransition, allTickets, groupTicketsByStage, toast, projectId]);

  // T038: Handle quick-impl cancellation
  const handleQuickImplCancel = useCallback(() => {
    setPendingTransition(null);
  }, []);

  // Get drop zone style based on drag state (T021)
  const getDropZoneStyle = useCallback(
    (stage: Stage): string => {
      if (!isDragging || !dragSource) return '';

      // If ticket has active job, disable all drop zones
      if (draggedTicketHasJob) {
        return 'opacity-50 cursor-not-allowed';
      }

      // Quick-impl mode: Dragging from INBOX
      if (dragSource === Stage.INBOX) {
        if (stage === Stage.SPECIFY) {
          // Normal workflow - blue
          return 'border-4 border-dashed border-blue-500 bg-blue-500/10';
        } else if (stage === Stage.BUILD) {
          // Quick-impl - green
          return 'border-4 border-dashed border-green-500 bg-green-500/10';
        } else {
          // Invalid - gray with reduced opacity
          return 'opacity-50 cursor-not-allowed';
        }
      }

      // Normal drag: Check if valid transition
      if (isValidTransition(dragSource, stage)) {
        return 'border-4 border-dashed border-blue-500 bg-blue-500/10';
      } else {
        return 'opacity-50 cursor-not-allowed';
      }
    },
    [isDragging, dragSource, draggedTicketHasJob]
  );

  const stages = getAllStages();

  // Check if any column is being hovered during drag
  const isAnyColumnOver = activeTicket !== null;

  return (
    <>
      <OfflineIndicator />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="w-full h-full bg-[#1e1e2e] relative">
          {/* Drop Zone Visual Feedback - Full Board */}
          {isAnyColumnOver && (
            <div className="absolute inset-0 border-4 border-dashed border-blue-500 pointer-events-none bg-blue-500/5 z-10" />
          )}

          {/* Board Grid - Restored original styling */}
          <div
            data-testid="board-grid"
            className="grid gap-4 overflow-x-auto pb-6 px-4 pt-4 relative z-20"
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
                dropZoneStyle={getDropZoneStyle(stage)}
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

      {/* Quick Implementation Modal (T039) */}
      <QuickImplModal
        open={!!pendingTransition}
        onConfirm={handleQuickImplConfirm}
        onCancel={handleQuickImplCancel}
      />
    </>
  );
}

/**
 * Board Component - Polling-Enabled Board
 *
 * Main board component with client-side polling for real-time updates.
 */
export function Board(props: BoardProps) {
  return <BoardContent {...props} />;
}

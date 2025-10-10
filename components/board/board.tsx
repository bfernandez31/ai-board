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

interface BoardProps {
  ticketsByStage: Record<Stage, TicketWithVersion[]>;
  projectId: number;
}

/**
 * Board Component - Drag and Drop Enabled
 *
 * Main kanban board with drag-and-drop functionality
 * - Optimistic UI updates
 * - Version-based conflict detection
 * - Sequential stage validation
 * - Touch and pointer support
 * - Project-scoped API calls
 */
export function Board({
  ticketsByStage: initialTicketsByStage,
  projectId,
}: BoardProps) {
  const [ticketsByStage, setTicketsByStage] = useState(initialTicketsByStage);
  const [activeTicket, setActiveTicket] = useState<TicketWithVersion | null>(
    null
  );
  const [selectedTicket, setSelectedTicket] =
    useState<TicketWithVersion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  // Sync local state with server data when props change (after router.refresh())
  React.useEffect(() => {
    setTicketsByStage(initialTicketsByStage);
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
        <div className="w-full h-full bg-black">
          {/* Board Grid - Restored original styling */}
          <div
            data-testid="board-grid"
            className="grid gap-4 overflow-x-auto pb-6 px-4 pt-4"
            style={{
              gridTemplateColumns: 'repeat(6, minmax(300px, 1fr))',
              height: 'calc(100vh - 32px)',
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

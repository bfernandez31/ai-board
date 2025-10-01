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
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Stage, isValidTransition, getAllStages } from '@/lib/stage-validation';
import { TicketWithVersion } from '@/lib/types';
import { updateTicketStageOptimistically, revertTicketStage } from '@/lib/optimistic-updates';
import { useToast } from '@/hooks/use-toast';

interface BoardProps {
  ticketsByStage: Record<Stage, TicketWithVersion[]>;
}

/**
 * Board Component - Drag and Drop Enabled
 *
 * Main kanban board with drag-and-drop functionality
 * - Optimistic UI updates
 * - Version-based conflict detection
 * - Sequential stage validation
 * - Touch and pointer support
 */
export function Board({ ticketsByStage: initialTicketsByStage }: BoardProps) {
  const [ticketsByStage, setTicketsByStage] = useState(initialTicketsByStage);
  const [activeTicket, setActiveTicket] = useState<TicketWithVersion | null>(null);
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
      const updatedTickets = updateTicketStageOptimistically(allTickets, ticket.id, targetStage);
      setTicketsByStage(groupTicketsByStage(updatedTickets));

      // Send update to server
      try {
        const response = await fetch(`/api/tickets/${ticket.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stage: targetStage,
            version: originalVersion,
          }),
        });

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
              description: error.message || 'An error occurred while updating the ticket.',
            });
          }
        } else {
          // Success
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
    [allTickets, isOnline, toast]
  );

  // Group tickets by stage
  const groupTicketsByStage = (tickets: TicketWithVersion[]): Record<Stage, TicketWithVersion[]> => {
    const grouped = getAllStages().reduce((acc, stage) => {
      acc[stage] = [];
      return acc;
    }, {} as Record<Stage, TicketWithVersion[]>);

    tickets.forEach((ticket) => {
      if (ticket.stage in grouped) {
        grouped[ticket.stage as Stage].push(ticket);
      }
    });

    return grouped;
  };

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
              gridTemplateColumns: 'repeat(5, minmax(300px, 1fr))',
              height: 'calc(100vh - 32px)',
            }}
          >
            {stages.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                tickets={ticketsByStage[stage] || []}
                isDraggable={isOnline}
              />
            ))}
          </div>
        </div>

        <DragOverlay activeTicket={activeTicket} />
      </DndContext>
    </>
  );
}

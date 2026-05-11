'use client';

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';
import { Stage, getAllStages } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import type { DualJobState } from '@/lib/types/job-types';
import { StageColumn } from './stage-column';
import { DragOverlay } from './drag-overlay';
import { TrashZone } from './trash-zone';
import { CloseZone } from './close-zone';
import type { ZoneState } from './hooks/use-zone-states';

interface BoardGridProps {
  projectId: number;
  ticketsByStage: Record<Stage, TicketWithVersion[]>;
  isOnline: boolean;
  onTicketClick: (ticket: TicketWithVersion) => void;
  getTicketJobs: (ticketId: number) => DualJobState;
  getDropZoneStyle: (stage: Stage) => string;
  activePreviewTicket: { ticketKey: string } | null;
  activeDeploymentTicket: number | null;
  hasMoreShipTickets: boolean;
  shipTotal: number;
  onLoadMoreShip: () => void;
  isLoadingMoreShip: boolean;

  // Drag state
  activeTicket: TicketWithVersion | null;
  isDragging: boolean;
  dragSource: Stage | null;
  draggedTicketHasJob: boolean;
  validRollbackTargets: Stage[];
  sensors: SensorDescriptor<SensorOptions>[];
  collisionDetection: CollisionDetection;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;

  // Zones
  trashZone: ZoneState;
  closeZone: ZoneState;
}

/**
 * The kanban grid: DndContext, columns, drag overlay, and trash/close zones.
 * Owns no state — the parent provides drag state and handlers via props.
 */
export function BoardGrid({
  projectId,
  ticketsByStage,
  isOnline,
  onTicketClick,
  getTicketJobs,
  getDropZoneStyle,
  activePreviewTicket,
  activeDeploymentTicket,
  hasMoreShipTickets,
  shipTotal,
  onLoadMoreShip,
  isLoadingMoreShip,
  activeTicket,
  isDragging,
  dragSource,
  draggedTicketHasJob,
  validRollbackTargets,
  sensors,
  collisionDetection,
  onDragStart,
  onDragEnd,
  onDragCancel,
  trashZone,
  closeZone,
}: BoardGridProps) {
  // AIB-148: Filter out CLOSED stage from board display — CLOSED tickets are not shown on the board
  const stages = getAllStages().filter((s) => s !== Stage.CLOSED);
  const isAnyColumnOver = activeTicket !== null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="w-full h-full relative">
        {isAnyColumnOver && (
          <div className="absolute inset-0 border-4 border-dashed border-primary pointer-events-none bg-primary/5 z-10" />
        )}

        <div
          data-testid="board-grid"
          className="grid gap-2 overflow-x-auto pb-6 px-4 pt-4 relative z-20"
          style={{
            gridTemplateColumns: 'repeat(6, minmax(300px, 1fr))',
            height: 'calc(100vh - 4rem - 4px)',
          }}
        >
          {stages.map((stage) => {
            // Allow rollback drops even when ticket has active job
            const isRollbackToInbox = dragSource === Stage.BUILD && stage === Stage.INBOX;
            const isRollbackToPlan = dragSource === Stage.VERIFY && stage === Stage.PLAN;
            const isNewRollbackTarget = validRollbackTargets.includes(stage);
            const isBlocked =
              isDragging &&
              draggedTicketHasJob &&
              !isRollbackToInbox &&
              !isRollbackToPlan &&
              !isNewRollbackTarget;

            return (
              <StageColumn
                key={stage}
                stage={stage}
                tickets={ticketsByStage[stage] || []}
                isDraggable={isOnline}
                onTicketClick={onTicketClick}
                projectId={projectId}
                getTicketJobs={getTicketJobs}
                dropZoneStyle={getDropZoneStyle(stage)}
                isBlockedByJob={isBlocked}
                activePreviewTicket={activePreviewTicket}
                activeDeploymentTicket={activeDeploymentTicket}
                {...(stage === Stage.SHIP && hasMoreShipTickets && {
                  totalCount: shipTotal,
                  onLoadMore: onLoadMoreShip,
                  isLoadingMore: isLoadingMoreShip,
                })}
              />
            );
          })}
        </div>
      </div>

      <DragOverlay activeTicket={activeTicket} />

      {trashZone.isVisible && (
        <TrashZone
          isVisible={trashZone.isVisible}
          isDisabled={trashZone.isDisabled}
          disabledReason={trashZone.disabledReason}
        />
      )}

      {closeZone.isVisible && (
        <CloseZone
          isVisible={closeZone.isVisible}
          isDisabled={closeZone.isDisabled}
          disabledReason={closeZone.disabledReason}
        />
      )}
    </DndContext>
  );
}

import { useCallback, useState } from 'react';
import {
  closestCenter,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useToast } from '@/hooks/use-toast';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { Stage, getValidRollbackTargets, isValidTransition } from '@/lib/stage-transitions';
import { TicketWithVersion } from '@/lib/types';
import type { DualJobState } from '@/lib/types/job-types';

interface UseBoardDragStateArgs {
  getTicketJobs: (ticketId: number) => DualJobState;
  onTrashDrop: (ticket: TicketWithVersion) => void;
  onCloseDrop: (ticket: TicketWithVersion) => void;
  onQuickImpl: (ticket: TicketWithVersion, targetStage: Stage) => void;
  onVerifyRollback: (ticket: TicketWithVersion, targetStage: Stage) => void;
  onNewRollback: (ticket: TicketWithVersion, targetStage: Stage) => void;
  onTransition: (ticket: TicketWithVersion, targetStage: Stage) => Promise<void> | void;
}

/**
 * Drag-and-drop orchestration: sensors, collision detection, drag start/end/cancel
 * handlers, and the active-drag state (source stage, active ticket, blocked flag,
 * valid rollback targets). Routes drop events into callback hooks so the board
 * can wire each scenario (trash, close, quick-impl, rollbacks, normal transition).
 */
export function useBoardDragState({
  getTicketJobs,
  onTrashDrop,
  onCloseDrop,
  onQuickImpl,
  onVerifyRollback,
  onNewRollback,
  onTransition,
}: UseBoardDragStateArgs) {
  const isOnline = useOnlineStatus();
  const { toast } = useToast();

  const [activeTicket, setActiveTicket] = useState<TicketWithVersion | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragSource, setDragSource] = useState<Stage | null>(null);
  const [draggedTicketHasJob, setDraggedTicketHasJob] = useState(false);
  const [validRollbackTargets, setValidRollbackTargets] = useState<Stage[]>([]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags with mouse
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300, // Long-press duration for deliberate drag on touch devices
        tolerance: 8, // Tighter tolerance: cancel drag activation if finger moves >8px during long-press
      },
    })
  );

  // Custom collision detection: require pointer to be physically inside
  // trash-zone / close-zone (pointerWithin), but use closestCenter for columns.
  const collisionDetection: CollisionDetection = useCallback((...args) => {
    const pointerCollisions = pointerWithin(...args);
    const actionZoneHit = pointerCollisions.find(
      (c) => c.id === 'trash-zone' || c.id === 'close-zone'
    );
    if (actionZoneHit) return [actionZoneHit];
    return closestCenter(...args);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const ticket = event.active.data.current?.ticket as TicketWithVersion;
    if (!ticket) return;

    setActiveTicket(ticket);
    setIsDragging(true);
    setDragSource(ticket.stage);

    // Block all normal transitions when workflow job is non-completed.
    // FAILED/CANCELLED jobs can still rollback to INBOX; AI-BOARD jobs never block.
    const jobs = getTicketJobs(ticket.id);
    const hasActiveWorkflowJob = jobs.workflow && jobs.workflow.status !== 'COMPLETED';
    setDraggedTicketHasJob(!!hasActiveWorkflowJob);

    // Compute valid rollback targets (AIB-512)
    const lastJobStatus = jobs.workflow?.status ?? null;
    const targets = getValidRollbackTargets(
      ticket.stage,
      ticket.workflowType as 'QUICK' | 'FULL' | 'CLEAN',
      lastJobStatus
    );
    setValidRollbackTargets(targets);
  }, [getTicketJobs]);

  const resetDragState = useCallback(() => {
    setActiveTicket(null);
    setIsDragging(false);
    setDragSource(null);
    setDraggedTicketHasJob(false);
    setValidRollbackTargets([]);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      resetDragState();

      const { active, over } = event;
      if (!over || !isOnline) return;

      const ticket = active.data.current?.ticket as TicketWithVersion;

      // T022: trash zone
      if (over.id === 'trash-zone') {
        onTrashDrop(ticket);
        return;
      }

      // AIB-148: close zone — only VERIFY tickets are eligible
      if (over.id === 'close-zone') {
        if (ticket.stage === Stage.VERIFY) onCloseDrop(ticket);
        return;
      }

      const targetStage = over.data.current?.stage as Stage;
      if (!ticket || !targetStage || ticket.stage === targetStage) return;

      if (!isValidTransition(ticket.stage, targetStage, ticket.workflowType)) {
        toast({
          variant: 'destructive',
          title: 'Invalid stage transition',
          description: `Cannot move from ${ticket.stage} to ${targetStage}. Tickets must progress sequentially.`,
        });
        return;
      }

      // T036: INBOX → BUILD opens quick-impl modal
      if (ticket.stage === Stage.INBOX && targetStage === Stage.BUILD) {
        onQuickImpl(ticket, targetStage);
        return;
      }

      // AIB-75: VERIFY → PLAN opens rollback modal
      if (ticket.stage === Stage.VERIFY && targetStage === Stage.PLAN) {
        onVerifyRollback(ticket, targetStage);
        return;
      }

      // AIB-512: extended rollback transitions open confirmation modal
      const isNewRollback =
        (ticket.stage === Stage.SPECIFY && targetStage === Stage.INBOX) ||
        (ticket.stage === Stage.PLAN && targetStage === Stage.SPECIFY) ||
        (ticket.stage === Stage.BUILD && targetStage === Stage.PLAN) ||
        (ticket.stage === Stage.VERIFY && targetStage === Stage.BUILD);
      if (isNewRollback) {
        onNewRollback(ticket, targetStage);
        return;
      }

      // AIB-148: VERIFY → CLOSED opens close confirmation modal
      if (ticket.stage === Stage.VERIFY && targetStage === Stage.CLOSED) {
        onCloseDrop(ticket);
        return;
      }

      await onTransition(ticket, targetStage);
    },
    [resetDragState, isOnline, toast, onTrashDrop, onCloseDrop, onQuickImpl, onVerifyRollback, onNewRollback, onTransition]
  );

  const handleDragCancel = useCallback(() => {
    // Resets all drag state when touch is interrupted (e.g., browser cancels touch
    // due to scroll conflicts), preventing the UI from getting stuck in drag mode.
    resetDragState();
  }, [resetDragState]);

  return {
    activeTicket,
    isDragging,
    dragSource,
    draggedTicketHasJob,
    validRollbackTargets,
    sensors,
    collisionDetection,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    isOnline,
  };
}

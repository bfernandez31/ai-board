'use client';

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { TicketWithVersion } from '@/lib/types';
import { Job } from '@prisma/client';
import { DeployConfirmationModal } from './deploy-confirmation-modal';
import { CancelConfirmationModal } from './cancel-confirmation-modal';
import { AutoModeConfirmationModal } from './auto-mode-confirmation-modal';
import { TicketCardHeader } from './ticket-card-header';
import { TicketCardJobStatus } from './ticket-card-job-status';
import { isTicketDeployable } from '@/app/lib/utils/deploy-preview-eligibility';
import { useDeployPreview } from '@/app/lib/hooks/mutations/useDeployPreview';
import { useCancelJob } from '@/lib/hooks/mutations/useCancelJob';
import { useAutoMode } from '@/app/lib/hooks/mutations/useAutoMode';
import { useHasMounted } from '@/lib/hooks/use-has-mounted';
import { isAutoModeEligible } from '@/app/lib/tickets/auto-mode-eligibility';

export interface TicketCardSelection {
  isSelected: boolean;
  isSelectMode: boolean;
  onToggle: () => void;
  onRangeSelect: () => void;
}

interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  workflowJob?: Job | null; // User Story 1: Workflow job display
  aiBoardJob?: Job | null; // User Story 2: AI-BOARD job display
  deployJob?: Job | null; // User Story: Deploy preview job display
  qualityScore?: number | null; // Quality score from latest COMPLETED verify job
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
  /** Ticket with active preview (for single-preview warning) */
  activePreviewTicket?: { ticketKey: string } | null;
  /** Ticket ID with active deployment (PENDING/RUNNING deploy job) */
  activeDeploymentTicket?: number | null;
  /** Bulk-selection wiring (INBOX only) — AIB-821 */
  selection?: TicketCardSelection;
}

/**
 * TicketCard Component - Original Design with Drag-and-Drop
 */
export const TicketCard = React.memo(
  ({
    ticket,
    workflowJob,
    aiBoardJob,
    deployJob,
    qualityScore,
    isDraggable = true,
    onTicketClick,
    activePreviewTicket,
    activeDeploymentTicket,
    selection,
  }: DraggableTicketCardProps) => {
    const isMounted = useHasMounted();
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showAutoModeModal, setShowAutoModeModal] = useState(false);

    // Deploy preview mutation
    const { mutate: deployPreview } = useDeployPreview(ticket.projectId);

    // Cancel job mutation
    const cancelJobMutation = useCancelJob(ticket.projectId);

    // Auto-mode mutation (AIB-682)
    const autoModeMutation = useAutoMode(ticket.projectId);

    const autoModeEligible = isAutoModeEligible({
      workflowType: ticket.workflowType,
      stage: ticket.stage,
    });

    const handleAutoModeClick = React.useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        if (ticket.autoMode) {
          autoModeMutation.mutate({ ticketId: ticket.id, enabled: false });
          return;
        }
        setShowAutoModeModal(true);
      },
      [autoModeMutation, ticket.autoMode, ticket.id]
    );

    const handleAutoModeConfirm = React.useCallback(() => {
      autoModeMutation.mutate({ ticketId: ticket.id, enabled: true });
      setShowAutoModeModal(false);
    }, [autoModeMutation, ticket.id]);

    // Check if ticket is deployable
    const isDeployable = React.useMemo(() => {
      return isTicketDeployable({
        stage: ticket.stage,
        branch: ticket.branch,
        jobs: ticket.jobs || [],
      });
    }, [ticket.stage, ticket.branch, ticket.jobs]);

    // Check if deploy is disabled due to another ticket's active deployment
    // Deploy is disabled when:
    // 1. Another ticket has a PENDING or RUNNING deployment
    // 2. This ticket is NOT the one with the active deployment
    const isDeployDisabled = React.useMemo(() => {
      return activeDeploymentTicket !== null && activeDeploymentTicket !== ticket.id;
    }, [activeDeploymentTicket, ticket.id]);


    const { attributes, listeners, setNodeRef, transform, isDragging } =
      useDraggable({
        id: `ticket-${ticket.id}`,
        data: {
          ticket,
          type: 'ticket',
        },
        disabled: !isDraggable,
      });

    const style = transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }
      : undefined;

    const handleClick = (event: React.MouseEvent) => {
      if (isDragging) return;
      if (selection) {
        if (event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          selection.onRangeSelect();
          return;
        }
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          event.stopPropagation();
          selection.onToggle();
          return;
        }
      }
      if (onTicketClick) {
        onTicketClick(ticket);
      }
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        data-ticket-id={ticket.id}
        data-testid="ticket-card"
        data-draggable={isDraggable ? 'true' : 'false'}
        onClick={handleClick}
        className={`
        transition-opacity touch-none
        ${isDragging ? 'opacity-30' : 'opacity-100'}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-60'}
      `}
        {...(isMounted ? attributes : {})}
        {...(isMounted ? listeners : {})}
      >
        <Card
          className="group aurora-glass aurora-glass-hover border p-4 transition-all hover:-translate-y-0.5 overflow-hidden relative"
          role="article"
          aria-label={`Ticket ${ticket.ticketKey}: ${ticket.title}`}
          data-selected={selection?.isSelected ? 'true' : 'false'}
        >
          {/* Header: Ticket Key and Badges */}
          <TicketCardHeader
            ticket={ticket}
            qualityScore={qualityScore}
            selection={selection}
          />

          {/* Cancel Confirmation Modal */}
          {workflowJob && (
            <CancelConfirmationModal
              open={showCancelModal}
              onOpenChange={setShowCancelModal}
              onConfirm={() => {
                cancelJobMutation.mutate(workflowJob.id);
                setShowCancelModal(false);
              }}
              jobCommand={workflowJob.command}
              isCancelling={cancelJobMutation.isPending}
            />
          )}

          {/* Auto-mode Confirmation Modal (AIB-682) */}
          {autoModeEligible && (
            <AutoModeConfirmationModal
              open={showAutoModeModal}
              onOpenChange={setShowAutoModeModal}
              onConfirm={handleAutoModeConfirm}
              currentStage={ticket.stage}
            />
          )}

          {/* Deploy Confirmation Modal */}
          <DeployConfirmationModal
            open={showDeployModal}
            onOpenChange={setShowDeployModal}
            onConfirm={() => {
              deployPreview({ ticketId: ticket.id });
              setShowDeployModal(false);
            }}
            ticketKey={ticket.ticketKey}
            hasExistingPreview={!!activePreviewTicket}
            existingPreviewTicket={activePreviewTicket?.ticketKey || undefined}
            isRetry={deployJob?.status === 'FAILED' || deployJob?.status === 'CANCELLED'}
          />

          {/* Title */}
          <h3
            className="font-semibold text-sm line-clamp-2 text-foreground break-words overflow-hidden mb-3"
            title={ticket.title}
          >
            {ticket.title}
          </h3>

          {/* Footer: Job Status Indicators + Auto-mode toggle */}
          <TicketCardJobStatus
            ticket={ticket}
            workflowJob={workflowJob}
            aiBoardJob={aiBoardJob}
            deployJob={deployJob}
            isDeployable={isDeployable}
            isDeployDisabled={isDeployDisabled}
            autoModeEligible={autoModeEligible}
            isAutoModePending={autoModeMutation.isPending}
            isCancelPending={cancelJobMutation.isPending}
            onAutoModeClick={handleAutoModeClick}
            onCancelClick={() => setShowCancelModal(true)}
            onDeployClick={() => setShowDeployModal(true)}
          />
        </Card>
      </div>
    );
  }
);

TicketCard.displayName = 'TicketCard';

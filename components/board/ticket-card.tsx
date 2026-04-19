'use client';

import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { TicketWithVersion } from '@/lib/types';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';
import { AgentIcon } from '@/components/ui/agent-icon';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { JobStatusIndicator } from './job-status-indicator';
import { Agent, Job } from '@prisma/client';
import { classifyJobType } from '@/lib/utils/job-type-classifier';
import { TicketCardDeployIcon } from './ticket-card-deploy-icon';
import { TicketCardPreviewIcon } from './ticket-card-preview-icon';
import { DeployConfirmationModal } from './deploy-confirmation-modal';
import { CancelConfirmationModal } from './cancel-confirmation-modal';
import { isTicketDeployable } from '@/app/lib/utils/deploy-preview-eligibility';
import { useDeployPreview } from '@/app/lib/hooks/mutations/useDeployPreview';
import { useCancelJob } from '@/lib/hooks/mutations/useCancelJob';
import { useHasMounted } from '@/lib/hooks/use-has-mounted';
import { QualityScoreBadge } from '@/components/ticket/quality-score-badge';
import { X } from 'lucide-react';
import { STAGE_MODEL_KEYS, STAGE_MODEL_LABELS } from '@/lib/models/claude-models';

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
    activeDeploymentTicket
  }: DraggableTicketCardProps) => {
    const isMounted = useHasMounted();
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);

    // Deploy preview mutation
    const { mutate: deployPreview } = useDeployPreview(ticket.projectId);

    // Cancel job mutation
    const cancelJobMutation = useCancelJob(ticket.projectId);

    // Check if ticket is deployable
    const isDeployable = React.useMemo(() => {
      return isTicketDeployable({
        stage: ticket.stage,
        branch: ticket.branch,
        jobs: ticket.jobs || [],
      });
    }, [ticket.stage, ticket.branch, ticket.jobs]);

    const isDeployDisabled =
      activeDeploymentTicket !== null && activeDeploymentTicket !== ticket.id;


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

    const effectiveAgent = ticket.agent ?? ticket.project?.defaultAgent;
    const isAgentInherited = ticket.agent == null;

    const overriddenStageLabels = React.useMemo(() => {
      return STAGE_MODEL_KEYS
        .filter((key) => ticket[key] != null)
        .map((key) => STAGE_MODEL_LABELS[key]);
    }, [ticket]);
    const hasModelOverride = overriddenStageLabels.length > 0;
    const isModelOverrideDormant = hasModelOverride && effectiveAgent != null && effectiveAgent !== Agent.CLAUDE;

    const isDeployJobActive = deployJob != null && (deployJob.status === 'PENDING' || deployJob.status === 'RUNNING');
    const showDeployButton = (!deployJob && isDeployable) || (deployJob != null && !isDeployJobActive && ticket.stage === 'VERIFY');

    // Cancel button: visible when ticket has PENDING or RUNNING workflow job
    const isCancellableJob = workflowJob && (workflowJob.status === 'PENDING' || workflowJob.status === 'RUNNING');

    const handleClick = () => {
      // Prevent click during drag
      if (!isDragging && onTicketClick) {
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
          className="group aurora-glass aurora-glass-hover border p-4 transition-all hover:-translate-y-0.5 overflow-hidden"
          role="article"
          aria-label={`Ticket ${ticket.ticketKey}: ${ticket.title}`}
        >
          {/* Header: Ticket Key and Badges */}
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs text-muted-foreground font-mono font-semibold">
              {ticket.ticketKey}
            </span>
            <div className="flex items-center gap-2">
              <QualityScoreBadge score={qualityScore ?? null} />
              {ticket.workflowType === 'QUICK' && (
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 shrink-0 px-1.5 py-0.5 font-semibold"
                >
                  ⚡ Quick
                </Badge>
              )}
              {ticket.workflowType === 'CLEAN' && (
                <Badge
                  variant="outline"
                  className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 shrink-0 px-1.5 py-0.5 font-semibold flex items-center gap-1"
                >
                  <Sparkles className="h-3 w-3" />
                  Clean
                </Badge>
              )}
              {/* Agent Badge (with optional custom-models halo ring) */}
              {effectiveAgent && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span data-testid="agent-badge" className="inline-flex shrink-0">
                      {hasModelOverride ? (
                        <span
                          data-testid="custom-models-badge"
                          data-dormant={isModelOverrideDormant ? 'true' : 'false'}
                          aria-label="Custom models configured"
                          className={`inline-flex items-center justify-center rounded-full p-0.5 ${
                            isModelOverrideDormant
                              ? 'ring-1 ring-muted-foreground/40'
                              : 'ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                          }`}
                        >
                          <AgentIcon agent={effectiveAgent} size={16} />
                        </span>
                      ) : (
                        <AgentIcon agent={effectiveAgent} size={16} />
                      )}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="font-medium">
                      {getAgentLabel(effectiveAgent)}{isAgentInherited ? ' (default)' : ''}
                    </div>
                    {hasModelOverride && (
                      <div className="text-[11px] opacity-90 mt-0.5">
                        {`Custom models: ${overriddenStageLabels.join(', ')}`}
                        {isModelOverrideDormant ? ' (inactive — agent is not Claude)' : ''}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

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

          {/* Job Status Indicators (Single-line layout with right-aligned compact icons) */}
          {(workflowJob || aiBoardJob || deployJob || isDeployable || ticket.previewUrl) && (
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between gap-3">
                {/* Left: Workflow Job Indicator + Cancel Button */}
                {workflowJob && (
                  <div className="flex items-center gap-1.5">
                    <JobStatusIndicator
                      status={workflowJob.status}
                      command={workflowJob.command}
                      jobType={classifyJobType(workflowJob.command)}
                      stage={ticket.stage}
                      animated={true}
                      completedAt={workflowJob.completedAt}
                    />
                    {isCancellableJob && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowCancelModal(true);
                        }}
                        disabled={cancelJobMutation.isPending}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                        aria-label="Cancel workflow"
                        data-testid="cancel-job-button"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Right: Compact icon indicators (Preview + Deploy + AI-BOARD) */}
                <div className="flex items-center gap-3">
                  {/* Preview Icon: Show only when ticket has active preview URL */}
                  {ticket.previewUrl && (
                    <TicketCardPreviewIcon
                      previewUrl={ticket.previewUrl}
                      ticketKey={ticket.ticketKey}
                    />
                  )}

                  {/* Deploy Icon: Show job status OR deploy button when deployable */}
                  {isDeployJobActive && (
                    <JobStatusIndicator
                      status={deployJob.status}
                      command={deployJob.command}
                      jobType={classifyJobType(deployJob.command)}
                      stage={ticket.stage}
                      animated={true}
                      completedAt={deployJob.completedAt}
                    />
                  )}
                  {showDeployButton && (
                    <TicketCardDeployIcon
                      onDeploy={() => setShowDeployModal(true)}
                      ticketKey={ticket.ticketKey}
                      isDeploying={false}
                      isDisabled={isDeployDisabled}
                    />
                  )}

                  {/* AI-BOARD Job Indicator (compact icon-only) */}
                  {aiBoardJob && (
                    <JobStatusIndicator
                      status={aiBoardJob.status}
                      command={aiBoardJob.command}
                      jobType={classifyJobType(aiBoardJob.command)}
                      stage={ticket.stage}
                      animated={true}
                      completedAt={aiBoardJob.completedAt}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }
);

TicketCard.displayName = 'TicketCard';

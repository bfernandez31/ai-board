'use client';

import React, { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { TicketWithVersion } from '@/lib/types';
import { JobStatusIndicator } from './job-status-indicator';
import { Job, Agent } from '@prisma/client';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';
import { classifyJobType } from '@/lib/utils/job-type-classifier';
import { TicketCardDeployIcon } from './ticket-card-deploy-icon';
import { TicketCardPreviewIcon } from './ticket-card-preview-icon';
import { DeployConfirmationModal } from './deploy-confirmation-modal';
import { isTicketDeployable } from '@/app/lib/utils/deploy-preview-eligibility';
import { useDeployPreview } from '@/app/lib/hooks/mutations/useDeployPreview';

interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  workflowJob?: Job | null; // User Story 1: Workflow job display
  aiBoardJob?: Job | null; // User Story 2: AI-BOARD job display
  deployJob?: Job | null; // User Story: Deploy preview job display
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
    isDraggable = true,
    onTicketClick,
    activePreviewTicket,
    activeDeploymentTicket
  }: DraggableTicketCardProps) => {
    const [isMounted, setIsMounted] = useState(false);
    const [showDeployModal, setShowDeployModal] = useState(false);

    // Deploy preview mutation
    const { mutate: deployPreview } = useDeployPreview(ticket.projectId);

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

    // Only apply drag attributes after client-side hydration to prevent SSR mismatch
    useEffect(() => {
      setIsMounted(true);
    }, []);

    const style = transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }
      : undefined;

    // Click handler that respects drag state
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
          className="bg-[#181825] border-[#313244] p-4 transition-all hover:border-[#45475a] hover:bg-[#1e1e2e] overflow-hidden shadow-sm"
          role="article"
          aria-label={`Ticket ${ticket.ticketKey}: ${ticket.title}`}
        >
          {/* Header: Ticket Key and Badges */}
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs text-[#a6adc8] font-mono font-semibold">
              {ticket.ticketKey}
            </span>
            <div className="flex items-center gap-2">
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
              <Badge
                variant="outline"
                className={`text-xs shrink-0 px-1.5 py-0.5 ${
                  ticket.agent !== null
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 font-semibold'
                    : 'bg-muted text-muted-foreground'
                }`}
                data-testid="agent-badge"
              >
                {getAgentLabel(ticket.agent ?? ticket.project?.defaultAgent ?? Agent.CLAUDE)}
                {ticket.agent === null && (
                  <span className="ml-0.5 opacity-70">(default)</span>
                )}
              </Badge>
            </div>
          </div>

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
            className="font-semibold text-sm line-clamp-2 text-[#cdd6f4] break-words overflow-hidden mb-3"
            title={ticket.title}
          >
            {ticket.title}
          </h3>

          {/* Job Status Indicators (Single-line layout with right-aligned compact icons) */}
          {(workflowJob || aiBoardJob || deployJob || isDeployable || ticket.previewUrl) && (
            <div className="border-t border-[#313244] pt-3">
              <div className="flex items-center justify-between gap-3">
                {/* Left: Workflow Job Indicator (simplified display) */}
                {workflowJob && (
                  <JobStatusIndicator
                    status={workflowJob.status}
                    command={workflowJob.command}
                    jobType={classifyJobType(workflowJob.command)}
                    stage={ticket.stage}
                    animated={true}
                    completedAt={workflowJob.completedAt}
                  />
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
                  {deployJob && (deployJob.status === 'PENDING' || deployJob.status === 'RUNNING') && (
                    <JobStatusIndicator
                      status={deployJob.status}
                      command={deployJob.command}
                      jobType={classifyJobType(deployJob.command)}
                      stage={ticket.stage}
                      animated={true}
                      completedAt={deployJob.completedAt}
                    />
                  )}
                  {/* Show deploy/retry button: deployable with no active job, or completed/failed deploy in VERIFY */}
                  {!(deployJob && (deployJob.status === 'PENDING' || deployJob.status === 'RUNNING')) &&
                    (isDeployable || (deployJob && ticket.stage === 'VERIFY')) && (
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

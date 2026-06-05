'use client';

import * as React from 'react';

import { X } from 'lucide-react';
import { Job } from '@prisma/client';
import { TicketWithVersion } from '@/lib/types';
import { JobStatusIndicator } from './job-status-indicator';
import { TicketCardDeployIcon } from './ticket-card-deploy-icon';
import { TicketCardPreviewIcon } from './ticket-card-preview-icon';
import { AutoModeIcon } from './auto-mode-icon';
import { classifyJobType } from '@/lib/utils/job-type-classifier';

interface TicketCardJobStatusProps {
  ticket: TicketWithVersion;
  workflowJob?: Job | null | undefined;
  aiBoardJob?: Job | null | undefined;
  deployJob?: Job | null | undefined;
  isDeployable: boolean;
  isDeployDisabled: boolean;
  autoModeEligible: boolean;
  isAutoModePending: boolean;
  isCancelPending: boolean;
  onAutoModeClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onCancelClick: () => void;
  onDeployClick: () => void;
}

/**
 * Ticket Card Footer: Job Status Indicators + Auto-mode toggle
 *
 * Renders the bottom region of a ticket card:
 * - When the card has no job/preview/deploy/auto-mode content but is auto-mode
 *   eligible, shows a standalone auto-mode toggle (space always reserved so the
 *   card height stays stable; the off-state icon fades in on hover).
 * - Otherwise shows a single-line layout with the workflow job indicator,
 *   cancel button and auto-mode toggle on the left, and compact preview/deploy/
 *   AI-BOARD icons on the right.
 */
export const TicketCardJobStatus = React.memo(
  ({
    ticket,
    workflowJob,
    aiBoardJob,
    deployJob,
    isDeployable,
    isDeployDisabled,
    autoModeEligible,
    isAutoModePending,
    isCancelPending,
    onAutoModeClick,
    onCancelClick,
    onDeployClick,
  }: TicketCardJobStatusProps) => {
    const hasFooterContent =
      !!(workflowJob || aiBoardJob || deployJob || isDeployable || ticket.previewUrl || ticket.autoMode);

    const isDeployJobActive =
      deployJob != null && (deployJob.status === 'PENDING' || deployJob.status === 'RUNNING');
    const showDeployButton =
      (!deployJob && isDeployable) ||
      (deployJob != null && !isDeployJobActive && ticket.stage === 'VERIFY');

    // Cancel button: visible when ticket has PENDING or RUNNING workflow job
    const isCancellableJob =
      !!workflowJob && (workflowJob.status === 'PENDING' || workflowJob.status === 'RUNNING');

    // Auto-mode footer for eligible tickets with no other visible content.
    if (!hasFooterContent) {
      if (!autoModeEligible) {
        return null;
      }
      return (
        <div className="pt-3">
          <AutoModeIcon
            autoMode={ticket.autoMode}
            onClick={onAutoModeClick}
            disabled={isAutoModePending}
          />
        </div>
      );
    }

    return (
      <div className="pt-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Workflow Job Indicator + Cancel Button + Auto-mode toggle */}
          {(workflowJob || autoModeEligible) && (
            <div className="flex items-center gap-1.5">
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
              {isCancellableJob && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancelClick();
                  }}
                  disabled={isCancelPending}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  aria-label="Cancel workflow"
                  data-testid="cancel-job-button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {autoModeEligible && (
                <AutoModeIcon
                  autoMode={ticket.autoMode}
                  onClick={onAutoModeClick}
                  disabled={isAutoModePending}
                />
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
                onDeploy={onDeployClick}
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
    );
  }
);

TicketCardJobStatus.displayName = 'TicketCardJobStatus';

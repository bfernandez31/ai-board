'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  ChevronDown,
  ChevronRight,
  X,
  FileText,
} from 'lucide-react';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';
import {
  formatCost,
  formatDuration,
  formatAbbreviatedNumber,
} from '@/lib/analytics/aggregations';
import { formatCommandName } from '@/lib/utils/format-command';
import { CancelConfirmationModal } from '@/components/board/cancel-confirmation-modal';
import { useCancelJob } from '@/lib/hooks/mutations/useCancelJob';
import { JobLogDialog } from '@/components/ticket/job-log-dialog';

/**
 * Status configuration type
 */
type StatusConfig = { icon: typeof CheckCircle2; color: string; label: string };

/**
 * Default status configuration (for PENDING and unknown statuses)
 */
const DEFAULT_STATUS: StatusConfig = { icon: Clock, color: 'text-muted-foreground', label: 'Pending' };

/**
 * Status icon mapping
 */
const STATUS_ICONS: Record<string, StatusConfig> = {
  COMPLETED: { icon: CheckCircle2, color: 'text-ctp-green', label: 'Completed' },
  FAILED: { icon: XCircle, color: 'text-ctp-red', label: 'Failed' },
  CANCELLED: { icon: Ban, color: 'text-ctp-peach', label: 'Cancelled' },
  RUNNING: { icon: Loader2, color: 'text-ctp-blue', label: 'Running' },
  PENDING: DEFAULT_STATUS,
};

/**
 * JobRow Component
 *
 * Single job entry with expandable token breakdown
 */
function JobRow({
  job,
  projectId,
  ticketId,
}: {
  job: TicketJobWithTelemetry;
  projectId?: number | undefined;
  ticketId?: number | undefined;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const cancelJobMutation = useCancelJob(projectId ?? 0);

  const statusConfig = STATUS_ICONS[job.status] ?? DEFAULT_STATUS;
  const StatusIcon = statusConfig.icon;
  const isRunning = job.status === 'RUNNING';
  const isCancellable = projectId != null && (job.status === 'PENDING' || job.status === 'RUNNING');

  // Check if job has telemetry data to expand
  const hasTelemetry =
    job.inputTokens != null ||
    job.outputTokens != null ||
    job.cacheReadTokens != null ||
    job.cacheCreationTokens != null;

  const hasLog = job.hasLog ?? (job.logSummary != null && job.logSummary.length > 0);
  const canOpenLog = hasLog && projectId != null && ticketId != null;

  return (
    <div className="space-y-1">
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="w-full flex items-center justify-between p-3 border border-ctp-mauve/15 rounded-lg transition-colors aurora-bg-muted"
        data-testid={`job-row-${job.id}`}
        disabled={!hasTelemetry}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Status Icon */}
          <StatusIcon
            className={`w-5 h-5 flex-shrink-0 ${statusConfig.color} ${isRunning ? 'animate-spin' : ''}`}
            aria-label={statusConfig.label}
          />

          {/* Command Name */}
          <span className="font-medium text-foreground truncate">
            {formatCommandName(job.command)}
          </span>

          {/* Model Badge */}
          {job.model && (
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded hidden sm:inline">
              {job.model}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Duration */}
          <span className="text-sm text-ctp-blue" data-testid={`job-duration-${job.id}`}>
            {job.durationMs != null ? formatDuration(job.durationMs) : '-'}
          </span>

          {/* Cost */}
          <span className="text-sm text-ctp-green w-16 text-right" data-testid={`job-cost-${job.id}`}>
            {job.costUsd != null ? formatCost(job.costUsd) : '-'}
          </span>

          {/* View Full Logs Button - visible when logs were captured */}
          {canOpenLog && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowLogDialog(true);
              }}
              className="p-1 rounded hover:bg-ctp-blue/20 text-muted-foreground hover:text-ctp-blue transition-colors"
              aria-label="View full logs"
              data-testid={`view-logs-${job.id}`}
              title="View full logs"
            >
              <FileText className="h-4 w-4" />
            </button>
          )}

          {/* Cancel Button - always visible for PENDING/RUNNING jobs */}
          {isCancellable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setShowCancelModal(true);
              }}
              disabled={cancelJobMutation.isPending}
              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Cancel workflow"
              data-testid={`cancel-job-${job.id}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {/* Expand/Collapse Indicator */}
          {hasTelemetry && (
            isOpen ? (
              <ChevronDown className="w-4 h-4 text-ctp-overlay0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-ctp-overlay0" />
            )
          )}
        </div>
      </CollapsibleTrigger>

      {/* Cancel Confirmation Modal */}
      {isCancellable && (
        <CancelConfirmationModal
          open={showCancelModal}
          onOpenChange={setShowCancelModal}
          onConfirm={() => {
            cancelJobMutation.mutate(job.id);
            setShowCancelModal(false);
          }}
          jobCommand={job.command}
          isCancelling={cancelJobMutation.isPending}
        />
      )}

      {hasTelemetry && (
        <CollapsibleContent className="pt-2">
          <div
            className="bg-card border border-border rounded-lg p-4 ml-8 space-y-3"
            data-testid={`job-details-${job.id}`}
          >
            {/* Token Breakdown */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-ctp-overlay0">Input Tokens:</span>
                <span className="ml-2 text-foreground font-medium">
                  {job.inputTokens != null ? formatAbbreviatedNumber(job.inputTokens) : '-'}
                </span>
              </div>
              <div>
                <span className="text-ctp-overlay0">Output Tokens:</span>
                <span className="ml-2 text-foreground font-medium">
                  {job.outputTokens != null ? formatAbbreviatedNumber(job.outputTokens) : '-'}
                </span>
              </div>
              <div>
                <span className="text-ctp-overlay0">Cache Read:</span>
                <span className="ml-2 text-foreground font-medium">
                  {job.cacheReadTokens != null ? formatAbbreviatedNumber(job.cacheReadTokens) : '-'}
                </span>
              </div>
              <div>
                <span className="text-ctp-overlay0">Cache Creation:</span>
                <span className="ml-2 text-foreground font-medium">
                  {job.cacheCreationTokens != null ? formatAbbreviatedNumber(job.cacheCreationTokens) : '-'}
                </span>
              </div>
            </div>

            {/* Timestamp */}
            <div className="text-xs text-ctp-overlay0 border-t border-border pt-3">
              Started {formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}
              {job.completedAt && (
                <> · Completed {formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })}</>
              )}
            </div>
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>

    {/* Inline log summary — visible without click to give users an at-a-glance
        sense of what the agent did or why it failed. */}
    {job.logSummary && (
      <p
        className="text-xs text-muted-foreground italic pl-11 pr-3 truncate"
        data-testid={`job-log-summary-${job.id}`}
        title={job.logSummary}
      >
        {job.logSummary}
      </p>
    )}

    {canOpenLog && (
      <JobLogDialog
        open={showLogDialog}
        onOpenChange={setShowLogDialog}
        projectId={projectId!}
        ticketId={ticketId!}
        jobId={job.id}
        command={job.command}
      />
    )}
    </div>
  );
}

/**
 * JobsTimeline Component
 *
 * Displays chronological list of all jobs with individual metrics
 * and expandable token breakdown
 */
interface JobsTimelineProps {
  jobs: TicketJobWithTelemetry[];
  projectId?: number | undefined;
  ticketId?: number | undefined;
}

export function JobsTimeline({ jobs, projectId, ticketId }: JobsTimelineProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-sm text-ctp-overlay0" data-testid="no-jobs-message">
        No jobs recorded
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="jobs-timeline">
      <h3 className="text-sm text-muted-foreground uppercase tracking-wider mb-3 font-bold">
        Jobs Timeline
      </h3>
      <div className="space-y-2">
        {jobs.map((job) => (
          <JobRow key={job.id} job={job} projectId={projectId} ticketId={ticketId} />
        ))}
      </div>
    </div>
  );
}

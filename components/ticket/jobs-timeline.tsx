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
  FileSearch,
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
import { Button } from '@/components/ui/button';

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
  onViewLogs,
}: {
  job: TicketJobWithTelemetry;
  projectId?: number | undefined;
  onViewLogs?: (jobId: number, jobCommand: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
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
  const hasLogSummary = job.logSummary != null;
  const canViewLogs =
    job.logAvailability === 'AVAILABLE' ||
    job.logAvailability === 'PARTIAL' ||
    job.logAvailability === 'PRUNED';
  const expandable = hasTelemetry || hasLogSummary;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="w-full flex items-center justify-between p-3 border border-ctp-mauve/15 rounded-lg transition-colors aurora-bg-muted"
        data-testid={`job-row-${job.id}`}
        disabled={!expandable}
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
          {job.logSummary ? (
            <span className="hidden max-w-[240px] truncate text-xs text-muted-foreground md:inline">
              {job.logSummary.headline}
            </span>
          ) : null}

          {/* Duration */}
          <span className="text-sm text-ctp-blue" data-testid={`job-duration-${job.id}`}>
            {job.durationMs != null ? formatDuration(job.durationMs) : '-'}
          </span>

          {/* Cost */}
          <span className="text-sm text-ctp-green w-16 text-right" data-testid={`job-cost-${job.id}`}>
            {job.costUsd != null ? formatCost(job.costUsd) : '-'}
          </span>

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
          {expandable && (
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

      {expandable && (
        <CollapsibleContent className="pt-2">
          <div
            className="bg-card border border-border rounded-lg p-4 ml-8 space-y-3"
            data-testid={`job-details-${job.id}`}
          >
            {job.logSummary ? (
              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{job.logSummary.headline}</p>
                    {job.logSummary.errorReason ? (
                      <p className="mt-1 text-xs text-ctp-red">{job.logSummary.errorReason}</p>
                    ) : null}
                  </div>
                  {canViewLogs && onViewLogs ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="shrink-0"
                      onClick={(event) => {
                        event.stopPropagation();
                        onViewLogs(job.id, job.command);
                      }}
                    >
                      <FileSearch className="mr-1.5 h-4 w-4" />
                      View full logs
                    </Button>
                  ) : null}
                </div>
                {job.logSummary.latestImportantEvents.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {job.logSummary.latestImportantEvents.map((event) => (
                      <p key={`${event.timestamp}-${event.label}`} className="text-xs text-muted-foreground">
                        {event.label}
                      </p>
                    ))}
                  </div>
                ) : null}
                {job.logAvailability === 'UNAVAILABLE' ? (
                  <p className="mt-2 text-xs text-muted-foreground">Detailed execution logs were unavailable for this run.</p>
                ) : null}
              </div>
            ) : null}

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
  onViewLogs?: (jobId: number, jobCommand: string) => void;
}

export function JobsTimeline({ jobs, projectId, onViewLogs }: JobsTimelineProps) {
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
          <JobRow
            key={job.id}
            job={job}
            projectId={projectId}
            {...(onViewLogs ? { onViewLogs } : {})}
          />
        ))}
      </div>
    </div>
  );
}

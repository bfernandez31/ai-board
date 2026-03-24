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
} from 'lucide-react';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';
import {
  formatCost,
  formatDuration,
  formatAbbreviatedNumber,
} from '@/lib/analytics/aggregations';

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
 * Format command name for display
 * e.g., "comment-specify" -> "Comment Specify", "quick-impl" -> "Quick Impl"
 */
function formatCommandName(command: string): string {
  return command
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * JobRow Component
 *
 * Single job entry with expandable token breakdown
 */
function JobRow({ job }: { job: TicketJobWithTelemetry }) {
  const [isOpen, setIsOpen] = useState(false);

  const statusConfig = STATUS_ICONS[job.status] ?? DEFAULT_STATUS;
  const StatusIcon = statusConfig.icon;
  const isRunning = job.status === 'RUNNING';

  // Check if job has telemetry data to expand
  const hasTelemetry =
    job.inputTokens != null ||
    job.outputTokens != null ||
    job.cacheReadTokens != null ||
    job.cacheCreationTokens != null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="w-full flex items-center justify-between p-3 bg-background border border-border rounded-lg hover:bg-secondary/50 transition-colors"
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
}

export function JobsTimeline({ jobs }: JobsTimelineProps) {
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
          <JobRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}

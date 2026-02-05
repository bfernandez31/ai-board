'use client';

import { useState, useMemo } from 'react';
import { formatDistanceToNow, subDays, isAfter } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  ChevronDown,
  ChevronRight,
  FileText,
  Settings2,
  CheckSquare,
  FileOutput,
  Cog,
  MessageSquare,
  Rocket,
  ExternalLink,
  Filter,
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
 * Default status configuration
 */
const DEFAULT_STATUS: StatusConfig = { icon: Clock, color: 'text-[#a6adc8]', label: 'Pending' };

/**
 * Status icon mapping with colors
 */
const STATUS_CONFIG: Record<string, StatusConfig> = {
  COMPLETED: { icon: CheckCircle2, color: 'text-[#a6e3a1]', label: 'Completed' },
  FAILED: { icon: XCircle, color: 'text-[#f38ba8]', label: 'Failed' },
  CANCELLED: { icon: Ban, color: 'text-[#fab387]', label: 'Cancelled' },
  RUNNING: { icon: Loader2, color: 'text-[#89b4fa]', label: 'Running' },
  PENDING: DEFAULT_STATUS,
};

/**
 * Job type icons and labels
 */
const JOB_TYPE_CONFIG: Record<string, { icon: typeof Cog; label: string }> = {
  // Workflow jobs
  specify: { icon: FileText, label: 'Specify' },
  plan: { icon: Settings2, label: 'Plan' },
  implement: { icon: Cog, label: 'Implement' },
  verify: { icon: CheckSquare, label: 'Verify' },
  'quick-impl': { icon: Cog, label: 'Quick Impl' },
  clean: { icon: Cog, label: 'Clean' },
  'rollback-reset': { icon: Cog, label: 'Rollback Reset' },
  // AI-Board assist jobs
  'comment-specify': { icon: MessageSquare, label: 'Comment (Specify)' },
  'comment-plan': { icon: MessageSquare, label: 'Comment (Plan)' },
  'comment-build': { icon: MessageSquare, label: 'Comment (Build)' },
  'comment-verify': { icon: MessageSquare, label: 'Comment (Verify)' },
  // Deploy jobs
  'deploy-preview': { icon: Rocket, label: 'Deploy Preview' },
};

/**
 * Artifacts created by each job command type
 */
const JOB_ARTIFACTS: Record<string, string[]> = {
  specify: ['spec.md'],
  plan: ['plan.md', 'tasks.md'],
  implement: ['summary.md'],
  'quick-impl': ['summary.md'],
  verify: [],
  'deploy-preview': [],
  clean: ['summary.md'],
};

/**
 * Get all unique commands from jobs for filter dropdown
 */
function getUniqueCommands(jobs: TicketJobWithTelemetry[]): string[] {
  const commands = new Set<string>();
  for (const job of jobs) {
    commands.add(job.command);
  }
  return Array.from(commands).sort();
}

/**
 * Date range filter options
 */
type DateRangeOption = 'all' | '7days' | '30days';

const DATE_RANGE_OPTIONS: Array<{ value: DateRangeOption; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '7days', label: 'Last 7 days' },
  { value: '30days', label: 'Last 30 days' },
];

/**
 * Status filter options
 */
const STATUS_OPTIONS = ['all', 'COMPLETED', 'FAILED', 'CANCELLED', 'RUNNING', 'PENDING'] as const;

/**
 * Format command name for display
 */
function formatCommandName(command: string): string {
  const config = JOB_TYPE_CONFIG[command];
  if (config) return config.label;

  return command
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get job type icon
 */
function getJobIcon(command: string) {
  return JOB_TYPE_CONFIG[command]?.icon ?? Cog;
}

/**
 * TimelineJobRow Component
 *
 * Single job entry with expandable details showing:
 * - Token breakdown
 * - Duration and cost
 * - Artifacts created
 * - Tools used
 */
function TimelineJobRow({ job }: { job: TicketJobWithTelemetry }) {
  const [isOpen, setIsOpen] = useState(false);

  const statusConfig = STATUS_CONFIG[job.status] ?? DEFAULT_STATUS;
  const StatusIcon = statusConfig.icon;
  const JobIcon = getJobIcon(job.command);
  const isRunning = job.status === 'RUNNING';
  const artifacts = JOB_ARTIFACTS[job.command] ?? [];

  const hasTelemetry =
    job.inputTokens != null ||
    job.outputTokens != null ||
    job.cacheReadTokens != null ||
    job.cacheCreationTokens != null ||
    (job.toolsUsed && job.toolsUsed.length > 0);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        className="w-full flex items-center justify-between p-3 bg-[#1e1e2e] border border-[#313244] rounded-lg hover:bg-[#313244]/50 transition-colors"
        data-testid={`timeline-job-${job.id}`}
        disabled={!hasTelemetry}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Job Type Icon */}
          <JobIcon
            className="w-4 h-4 flex-shrink-0 text-[#89b4fa]"
            aria-hidden="true"
          />

          {/* Status Icon */}
          <StatusIcon
            className={`w-5 h-5 flex-shrink-0 ${statusConfig.color} ${isRunning ? 'animate-spin' : ''}`}
            aria-label={statusConfig.label}
          />

          {/* Command Name */}
          <span className="font-medium text-[#cdd6f4] truncate">
            {formatCommandName(job.command)}
          </span>

          {/* Model Badge */}
          {job.model && (
            <span className="text-xs text-[#6c7086] bg-[#313244] px-2 py-0.5 rounded hidden sm:inline">
              {job.model}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Start Time */}
          <span className="text-xs text-[#6c7086] hidden sm:inline">
            {formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}
          </span>

          {/* Duration */}
          <span className="text-sm text-[#89b4fa]" data-testid={`timeline-duration-${job.id}`}>
            {job.durationMs != null ? formatDuration(job.durationMs) : '-'}
          </span>

          {/* Cost */}
          <span className="text-sm text-[#a6e3a1] w-16 text-right" data-testid={`timeline-cost-${job.id}`}>
            {job.costUsd != null ? formatCost(job.costUsd) : '-'}
          </span>

          {/* Expand/Collapse Indicator */}
          {hasTelemetry && (
            isOpen ? (
              <ChevronDown className="w-4 h-4 text-[#6c7086]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-[#6c7086]" />
            )
          )}
        </div>
      </CollapsibleTrigger>

      {hasTelemetry && (
        <CollapsibleContent className="pt-2">
          <div
            className="bg-[#181825] border border-[#313244] rounded-lg p-4 ml-8 space-y-4"
            data-testid={`timeline-details-${job.id}`}
          >
            {/* Token Breakdown */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[#6c7086]">Input Tokens:</span>
                <span className="ml-2 text-[#cdd6f4] font-medium">
                  {job.inputTokens != null ? formatAbbreviatedNumber(job.inputTokens) : '-'}
                </span>
              </div>
              <div>
                <span className="text-[#6c7086]">Output Tokens:</span>
                <span className="ml-2 text-[#cdd6f4] font-medium">
                  {job.outputTokens != null ? formatAbbreviatedNumber(job.outputTokens) : '-'}
                </span>
              </div>
              <div>
                <span className="text-[#6c7086]">Cache Read:</span>
                <span className="ml-2 text-[#cdd6f4] font-medium">
                  {job.cacheReadTokens != null ? formatAbbreviatedNumber(job.cacheReadTokens) : '-'}
                </span>
              </div>
              <div>
                <span className="text-[#6c7086]">Cache Creation:</span>
                <span className="ml-2 text-[#cdd6f4] font-medium">
                  {job.cacheCreationTokens != null ? formatAbbreviatedNumber(job.cacheCreationTokens) : '-'}
                </span>
              </div>
            </div>

            {/* Artifacts Created */}
            {artifacts.length > 0 && job.status === 'COMPLETED' && (
              <div className="border-t border-[#313244] pt-3">
                <span className="text-xs text-[#6c7086] uppercase tracking-wider mb-2 block">Artifacts Created</span>
                <div className="flex flex-wrap gap-2">
                  {artifacts.map((artifact) => (
                    <Badge
                      key={artifact}
                      variant="secondary"
                      className="bg-[#313244] text-[#89b4fa] border-[#45475a] text-xs"
                    >
                      <FileOutput className="w-3 h-3 mr-1" />
                      {artifact}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tools Used */}
            {job.toolsUsed && job.toolsUsed.length > 0 && (
              <div className="border-t border-[#313244] pt-3">
                <span className="text-xs text-[#6c7086] uppercase tracking-wider mb-2 block">Tools Used</span>
                <div className="flex flex-wrap gap-1">
                  {job.toolsUsed.map((tool) => (
                    <Badge
                      key={tool}
                      variant="outline"
                      className="text-[#cdd6f4] border-[#45475a] text-xs"
                    >
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamp */}
            <div className="text-xs text-[#6c7086] border-t border-[#313244] pt-3">
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
 * WorkflowTimeline Props
 */
interface WorkflowTimelineProps {
  jobs: TicketJobWithTelemetry[];
  /** GitHub owner for workflow links (optional) */
  githubOwner?: string | undefined;
  /** GitHub repo for workflow links (optional) */
  githubRepo?: string | undefined;
}

/**
 * WorkflowTimeline Component
 *
 * Displays a chronological timeline of all workflow executions for a ticket
 * with filtering by job type, status, and date range.
 */
export function WorkflowTimeline({ jobs, githubOwner, githubRepo }: WorkflowTimelineProps) {
  const [commandFilter, setCommandFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateRangeOption>('all');

  // Get unique commands for filter dropdown
  const uniqueCommands = useMemo(() => getUniqueCommands(jobs), [jobs]);

  // Apply filters and sort chronologically (most recent first)
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Filter by command
    if (commandFilter !== 'all') {
      result = result.filter((job) => job.command === commandFilter);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter((job) => job.status === statusFilter);
    }

    // Filter by date range
    if (dateFilter !== 'all') {
      const cutoffDate = dateFilter === '7days' ? subDays(new Date(), 7) : subDays(new Date(), 30);
      result = result.filter((job) => isAfter(new Date(job.startedAt), cutoffDate));
    }

    // Sort by most recent first
    return result.sort((a, b) => {
      const dateA = new Date(a.startedAt).getTime();
      const dateB = new Date(b.startedAt).getTime();
      return dateB - dateA;
    });
  }, [jobs, commandFilter, statusFilter, dateFilter]);

  // Check if filters are active
  const hasActiveFilters = commandFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all';

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="w-12 h-12 text-[#6c7086] mx-auto mb-3" />
        <p className="text-sm text-[#6c7086]" data-testid="no-jobs-message">
          No workflow executions yet
        </p>
        <p className="text-xs text-[#6c7086] mt-1">
          Jobs will appear here when workflows run on this ticket
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="workflow-timeline">
      {/* Filter Section */}
      <div className="flex flex-wrap items-center gap-3 pb-3 border-b border-[#313244]">
        <div className="flex items-center gap-2 text-[#a6adc8]">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
        </div>

        {/* Command Filter */}
        <Select value={commandFilter} onValueChange={setCommandFilter}>
          <SelectTrigger
            className="w-[140px] h-8 text-xs bg-[#1e1e2e] border-[#313244]"
            data-testid="command-filter"
          >
            <SelectValue placeholder="Job Type" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e2e] border-[#313244]">
            <SelectItem value="all">All Types</SelectItem>
            {uniqueCommands.map((command) => (
              <SelectItem key={command} value={command}>
                {formatCommandName(command)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-[130px] h-8 text-xs bg-[#1e1e2e] border-[#313244]"
            data-testid="status-filter"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e2e] border-[#313244]">
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.slice(1).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_CONFIG[status]?.label ?? status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range Filter */}
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateRangeOption)}>
          <SelectTrigger
            className="w-[130px] h-8 text-xs bg-[#1e1e2e] border-[#313244]"
            data-testid="date-filter"
          >
            <SelectValue placeholder="Date Range" />
          </SelectTrigger>
          <SelectContent className="bg-[#1e1e2e] border-[#313244]">
            {DATE_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Results count */}
        <span className="text-xs text-[#6c7086] ml-auto">
          {filteredJobs.length} of {jobs.length} jobs
        </span>
      </div>

      {/* Timeline List */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-[#6c7086]" data-testid="no-results-message">
            No jobs match the selected filters
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setCommandFilter('all');
                setStatusFilter('all');
                setDateFilter('all');
              }}
              className="text-xs text-[#89b4fa] hover:underline mt-2"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2" data-testid="timeline-list">
          {filteredJobs.map((job) => (
            <TimelineJobRow key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* GitHub Actions link hint */}
      {githubOwner && githubRepo && (
        <div className="text-xs text-[#6c7086] pt-2 border-t border-[#313244] flex items-center gap-1">
          <ExternalLink className="w-3 h-3" />
          <a
            href={`https://github.com/${githubOwner}/${githubRepo}/actions`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#89b4fa] hover:underline"
          >
            View all workflow runs in GitHub Actions
          </a>
        </div>
      )}
    </div>
  );
}

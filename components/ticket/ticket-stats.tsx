'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Clock, Coins, Zap, Wrench } from 'lucide-react';
import type { TicketJob } from '@/components/board/ticket-detail-modal';
import type { TicketJobWithTelemetry } from '@/lib/types/job-types';
import { useTicketStats, type TicketStats as TicketStatsType } from '@/lib/hooks/use-ticket-stats';
import {
  formatCost,
  formatDuration,
  formatPercentage,
  formatAbbreviatedNumber,
} from '@/lib/analytics/aggregations';
import { JobsTimeline } from './jobs-timeline';

/**
 * Props for TicketStats component
 */
interface TicketStatsProps {
  /** Full job data with telemetry from API/cache */
  jobs: TicketJobWithTelemetry[];
  /** Lightweight polled jobs for real-time status updates */
  polledJobs: TicketJob[];
}

/**
 * StatsSummaryCards Component
 *
 * Displays 4 summary cards showing aggregated statistics:
 * - Total Cost (USD)
 * - Total Duration (formatted)
 * - Total Tokens (input + output)
 * - Cache Efficiency (percentage)
 */
function StatsSummaryCards({ stats }: { stats: TicketStatsType }) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-6" data-testid="stats-summary-cards">
      {/* Total Cost Card */}
      <Card className="bg-[#1e1e2e] border-[#313244]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-[#a6adc8] mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Total Cost</span>
          </div>
          <p className="text-2xl font-bold text-[#a6e3a1]" data-testid="total-cost">
            {stats.hasData ? formatCost(stats.totalCost) : 'N/A'}
          </p>
        </CardContent>
      </Card>

      {/* Total Duration Card */}
      <Card className="bg-[#1e1e2e] border-[#313244]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-[#a6adc8] mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Total Duration</span>
          </div>
          <p className="text-2xl font-bold text-[#89b4fa]" data-testid="total-duration">
            {stats.hasData ? formatDuration(stats.totalDuration) : 'N/A'}
          </p>
        </CardContent>
      </Card>

      {/* Total Tokens Card */}
      <Card className="bg-[#1e1e2e] border-[#313244]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-[#a6adc8] mb-1">
            <Coins className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Total Tokens</span>
          </div>
          <p className="text-2xl font-bold text-[#f9e2af]" data-testid="total-tokens">
            {stats.hasData ? formatAbbreviatedNumber(stats.totalTokens) : 'N/A'}
          </p>
        </CardContent>
      </Card>

      {/* Cache Efficiency Card */}
      <Card className="bg-[#1e1e2e] border-[#313244]">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-[#a6adc8] mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Cache Efficiency</span>
          </div>
          <p className="text-2xl font-bold text-[#cba6f7]" data-testid="cache-efficiency">
            {stats.hasData ? formatPercentage(stats.cacheEfficiency) : 'N/A'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * ToolsUsageSection Component
 *
 * Displays aggregated tool usage counts sorted by frequency
 */
function ToolsUsageSection({ toolsUsage }: { toolsUsage: TicketStatsType['toolsUsage'] }) {
  if (toolsUsage.length === 0) {
    return (
      <div className="mt-6">
        <h3 className="text-sm text-[#a6adc8] uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
          <Wrench className="w-4 h-4" />
          Tools Used
        </h3>
        <p className="text-sm text-[#6c7086]" data-testid="no-tools-message">No tools recorded</p>
      </div>
    );
  }

  return (
    <div className="mt-6" data-testid="tools-usage-section">
      <h3 className="text-sm text-[#a6adc8] uppercase tracking-wider mb-3 font-bold flex items-center gap-2">
        <Wrench className="w-4 h-4" />
        Tools Used
      </h3>
      <div className="flex flex-wrap gap-2">
        {toolsUsage.map(({ tool, count }) => (
          <Badge
            key={tool}
            variant="secondary"
            className="bg-[#313244] text-[#cdd6f4] border-[#45475a] text-xs px-2 py-1"
            data-testid={`tool-badge-${tool}`}
          >
            {tool}
            <span className="ml-1.5 text-[#a6adc8]">({count})</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}

/**
 * TicketStats Component
 *
 * Main Stats tab content displaying:
 * - Summary cards with aggregated metrics
 * - Chronological jobs timeline with expandable details
 * - Aggregated tool usage statistics
 *
 * Merges full job data (from server) with polled status updates (real-time)
 */
export function TicketStats({ jobs, polledJobs }: TicketStatsProps) {
  // Merge full jobs with polled status updates
  // This ensures status is always up-to-date while preserving telemetry data
  const mergedJobs = useMemo<TicketJobWithTelemetry[]>(() => {
    return jobs.map((job) => {
      // Find matching polled job for latest status
      const polledJob = polledJobs.find((p) => p.id === job.id);

      return {
        id: job.id,
        command: job.command,
        status: polledJob?.status ?? job.status,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        inputTokens: job.inputTokens,
        outputTokens: job.outputTokens,
        cacheReadTokens: job.cacheReadTokens,
        cacheCreationTokens: job.cacheCreationTokens,
        costUsd: job.costUsd,
        durationMs: job.durationMs,
        model: job.model,
        toolsUsed: job.toolsUsed,
      };
    });
  }, [jobs, polledJobs]);

  // Compute aggregated stats using the hook
  const stats = useTicketStats(mergedJobs);

  return (
    <div className="space-y-2" data-testid="ticket-stats">
      {/* Summary Cards */}
      <StatsSummaryCards stats={stats} />

      {/* Jobs Timeline */}
      <JobsTimeline jobs={stats.jobs} />

      {/* Tools Usage */}
      <ToolsUsageSection toolsUsage={stats.toolsUsage} />
    </div>
  );
}

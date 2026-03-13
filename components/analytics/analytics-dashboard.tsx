'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import {
  getStatusScopeLabel,
  normalizeAnalyticsQueryState,
  type AnalyticsData,
  type AnalyticsQueryState,
  type TimeRange,
} from '@/lib/analytics/types';
import { TimeRangeSelector } from './time-range-selector';
import { OverviewCards } from './overview-cards';
import { EmptyState } from './empty-state';
import { CostOverTimeChart } from './cost-over-time-chart';
import { CostByStageChart } from './cost-by-stage-chart';
import { TokenUsageChart } from './token-usage-chart';
import { CacheEfficiencyChart } from './cache-efficiency-chart';
import { TopToolsChart } from './top-tools-chart';
import { WorkflowDistributionChart } from './workflow-distribution-chart';
import { VelocityChart } from './velocity-chart';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradePrompt } from '@/components/billing/upgrade-prompt';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AnalyticsDashboardProps {
  projectId: number;
  initialData: AnalyticsData;
}

const STATUS_SCOPE_OPTIONS = ['shipped', 'closed', 'shipped+closed'] as const;

async function fetchAnalytics(
  projectId: number,
  filters: AnalyticsQueryState
): Promise<AnalyticsData> {
  const params = new URLSearchParams({
    range: filters.range,
    statusScope: filters.statusScope,
    agentScope: filters.agentScope,
  });
  const response = await fetch(`/api/projects/${projectId}/analytics?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }
  return response.json();
}

function renderStatusScopeOptions() {
  return STATUS_SCOPE_OPTIONS.map((scope) => (
    <SelectItem key={scope} value={scope}>
      {getStatusScopeLabel(scope)}
    </SelectItem>
  ));
}

function hasMatchingInitialFilters(
  filters: AnalyticsQueryState,
  initialData: AnalyticsData
): boolean {
  return (
    filters.range === initialData.filters.timeRange &&
    filters.statusScope === initialData.filters.statusScope &&
    filters.agentScope === initialData.filters.agentScope
  );
}

interface AnalyticsFiltersProps {
  availableAgents: AnalyticsData['availableAgents'];
  filters: AnalyticsQueryState;
  onAgentScopeChange: (agentScope: AnalyticsQueryState['agentScope']) => void;
  onRangeChange: (range: TimeRange) => void;
  onStatusScopeChange: (statusScope: AnalyticsQueryState['statusScope']) => void;
}

function AnalyticsFilters({
  availableAgents,
  filters,
  onAgentScopeChange,
  onRangeChange,
  onStatusScopeChange,
}: AnalyticsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:justify-end">
      <TimeRangeSelector value={filters.range} onChange={onRangeChange} />
      <Select value={filters.statusScope} onValueChange={onStatusScopeChange}>
        <SelectTrigger className="w-full md:w-[180px]" aria-label="Status scope">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{renderStatusScopeOptions()}</SelectContent>
      </Select>
      <Select value={filters.agentScope} onValueChange={onAgentScopeChange}>
        <SelectTrigger className="w-full md:w-[180px]" aria-label="Agent scope">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All agents</SelectItem>
          {availableAgents.map((agent) => (
            <SelectItem key={agent.value} value={agent.value}>
              {agent.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AnalyticsDashboard({ projectId, initialData }: AnalyticsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<AnalyticsQueryState>(
    normalizeAnalyticsQueryState({
      range: searchParams.get('range') ?? initialData.filters.timeRange,
      statusScope: searchParams.get('statusScope') ?? initialData.filters.statusScope,
      agentScope: searchParams.get('agentScope') ?? initialData.filters.agentScope,
    })
  );

  const { data } = useQuery({
    queryKey: queryKeys.analytics.data(projectId, filters),
    queryFn: () => fetchAnalytics(projectId, filters),
    initialData: hasMatchingInitialFilters(filters, initialData) ? initialData : undefined,
    refetchInterval: 15000, // 15-second polling
    staleTime: 10000,
  });

  const { data: subscription } = useSubscription();
  const analytics = data ?? initialData;

  const updateFilters = (nextFilters: AnalyticsQueryState) => {
    setFilters(nextFilters);
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', nextFilters.range);
    params.set('statusScope', nextFilters.statusScope);
    params.set('agentScope', nextFilters.agentScope);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const handleRangeChange = (range: TimeRange) => {
    updateFilters({ ...filters, range });
  };

  const handleStatusScopeChange = (statusScope: AnalyticsQueryState['statusScope']) => {
    updateFilters({ ...filters, statusScope });
  };

  const handleAgentScopeChange = (agentScope: AnalyticsQueryState['agentScope']) => {
    updateFilters({ ...filters, agentScope });
  };

  if (!analytics.hasData) {
    return (
      <div className="space-y-6">
        <AnalyticsFilters
          availableAgents={analytics.availableAgents}
          filters={filters}
          onAgentScopeChange={handleAgentScopeChange}
          onRangeChange={handleRangeChange}
          onStatusScopeChange={handleStatusScopeChange}
        />
        <EmptyState filters={analytics.filters} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnalyticsFilters
        availableAgents={analytics.availableAgents}
        filters={filters}
        onAgentScopeChange={handleAgentScopeChange}
        onRangeChange={handleRangeChange}
        onStatusScopeChange={handleStatusScopeChange}
      />

      <OverviewCards metrics={analytics.overview} />

      {/* Charts Grid - Responsive Bento Layout */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Cost Over Time - Full width on mobile, 2 cols on large */}
        <div className="md:col-span-2">
          <CostOverTimeChart data={analytics.costOverTime} />
        </div>

        {/* Cost by Stage */}
        <div className="lg:col-span-1">
          <CostByStageChart data={analytics.costByStage} />
        </div>

        {/* Token Usage */}
        <div>
          <TokenUsageChart data={analytics.tokenUsage} />
        </div>

        {/* Cache Efficiency */}
        <div>
          <CacheEfficiencyChart data={analytics.cacheEfficiency} />
        </div>

        {/* Top Tools */}
        <div>
          <TopToolsChart data={analytics.topTools} />
        </div>

        {/* Workflow Distribution */}
        <div>
          <WorkflowDistributionChart data={analytics.workflowDistribution} />
        </div>

        {/* Velocity */}
        <div className="md:col-span-2">
          <VelocityChart data={analytics.velocity} />
        </div>
      </div>

      {/* Advanced Analytics Section */}
      {subscription && !subscription.limits.advancedAnalytics && (
        <UpgradePrompt
          title="Advanced Analytics"
          description="Unlock advanced analytics including custom reports, trend analysis, and team performance metrics. Available on the Team plan."
        />
      )}
    </div>
  );
}

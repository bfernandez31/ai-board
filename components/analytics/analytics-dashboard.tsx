'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import type { AnalyticsData, TimeRange } from '@/lib/analytics/types';
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

interface AnalyticsDashboardProps {
  projectId: number;
  initialData: AnalyticsData;
}

async function fetchAnalytics(projectId: number, range: TimeRange): Promise<AnalyticsData> {
  const response = await fetch(`/api/projects/${projectId}/analytics?range=${range}`);
  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }
  return response.json();
}

export function AnalyticsDashboard({ projectId, initialData }: AnalyticsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRange = (searchParams.get('range') as TimeRange) || initialData.timeRange;
  const [range, setRange] = useState<TimeRange>(initialRange);

  const { data } = useQuery({
    queryKey: queryKeys.analytics.data(projectId, range),
    queryFn: () => fetchAnalytics(projectId, range),
    initialData: range === initialData.timeRange ? initialData : undefined,
    refetchInterval: 15000, // 15-second polling
    staleTime: 10000,
  });

  const { data: subscription } = useSubscription();
  const analytics = data ?? initialData;

  const handleRangeChange = (newRange: TimeRange) => {
    setRange(newRange);
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', newRange);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  if (!analytics.hasData) {
    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <TimeRangeSelector value={range} onChange={handleRangeChange} />
        </div>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <TimeRangeSelector value={range} onChange={handleRangeChange} />
      </div>

      {/* Overview Cards */}
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

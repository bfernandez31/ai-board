'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import type { AgentFilter, AnalyticsData, AnalyticsFilters, TicketOutcomeFilter, TimeRange } from '@/lib/analytics/types';
import {
  buildAnalyticsEmptyMessage,
  DEFAULT_ANALYTICS_FILTERS,
  getAgentLabel,
  getOutcomeLabel,
} from '@/lib/analytics/aggregations';
import { TimeRangeSelector } from './time-range-selector';
import { OverviewCards } from './overview-cards';
import { EmptyState, NO_CONTEXT_EMPTY_MESSAGE } from './empty-state';
import { CostOverTimeChart } from './cost-over-time-chart';
import { CostByStageChart } from './cost-by-stage-chart';
import { TokenUsageChart } from './token-usage-chart';
import { CacheEfficiencyChart } from './cache-efficiency-chart';
import { TopToolsChart } from './top-tools-chart';
import { WorkflowDistributionChart } from './workflow-distribution-chart';
import { VelocityChart } from './velocity-chart';
import { QualityScoreTrendChart } from './quality-score-trend-chart';
import { DimensionComparisonChart } from './dimension-comparison-chart';
import { ContextPeakDistributionChart } from './context-peak-distribution-chart';
import { ContextQualityBucketChart } from './context-quality-bucket-chart';
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

const OUTCOME_OPTIONS = ['shipped', 'closed', 'all-completed'] as const;
const COMMAND_OPTIONS = ['all', 'specify', 'plan', 'implement', 'verify', 'quick-impl'] as const;
const WORKFLOW_OPTIONS = ['all', 'FULL', 'QUICK', 'CLEAN'] as const;
const QUALITY_BUCKET_OPTIONS = ['all', 'HIGH', 'MEDIUM', 'LOW'] as const;

async function fetchAnalytics(projectId: number, filters: AnalyticsFilters): Promise<AnalyticsData> {
  const params = new URLSearchParams({
    range: filters.range,
    outcome: filters.outcome,
    agent: filters.agent,
    command: filters.command,
    workflowType: filters.workflowType,
    qualityBucket: filters.qualityBucket,
  });
  const response = await fetch(`/api/projects/${projectId}/analytics?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch analytics');
  }
  return response.json();
}

function filtersMatch(left: AnalyticsFilters, right: AnalyticsFilters): boolean {
  return left.range === right.range
    && left.outcome === right.outcome
    && left.agent === right.agent
    && left.command === right.command
    && left.workflowType === right.workflowType
    && left.qualityBucket === right.qualityBucket;
}

function getInitialFilters(searchParams: URLSearchParams, initialData: AnalyticsData): AnalyticsFilters {
  return {
    range: (searchParams.get('range') as TimeRange) || initialData.filters.range || DEFAULT_ANALYTICS_FILTERS.range,
    outcome:
      (searchParams.get('outcome') as TicketOutcomeFilter) ||
      initialData.filters.outcome ||
      DEFAULT_ANALYTICS_FILTERS.outcome,
    agent:
      (searchParams.get('agent') as AgentFilter) ||
      initialData.filters.agent ||
      DEFAULT_ANALYTICS_FILTERS.agent,
    command: searchParams.get('command') || initialData.filters.command || DEFAULT_ANALYTICS_FILTERS.command,
    workflowType:
      (searchParams.get('workflowType') as AnalyticsFilters['workflowType']) ||
      initialData.filters.workflowType ||
      DEFAULT_ANALYTICS_FILTERS.workflowType,
    qualityBucket:
      (searchParams.get('qualityBucket') as AnalyticsFilters['qualityBucket']) ||
      initialData.filters.qualityBucket ||
      DEFAULT_ANALYTICS_FILTERS.qualityBucket,
  };
}

function buildFilterSearchParams(
  searchParams: URLSearchParams,
  filters: AnalyticsFilters
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  params.set('range', filters.range);
  params.set('outcome', filters.outcome);
  params.set('agent', filters.agent);
  params.set('command', filters.command);
  params.set('workflowType', filters.workflowType);
  params.set('qualityBucket', filters.qualityBucket);
  return params;
}

export function AnalyticsDashboard({ projectId, initialData }: AnalyticsDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<AnalyticsFilters>(() =>
    getInitialFilters(searchParams, initialData)
  );

  const shouldUseInitialData = filtersMatch(filters, initialData.filters);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.analytics.data(
      projectId,
      filters.range,
      filters.outcome,
      filters.agent,
      filters.command,
      filters.workflowType,
      filters.qualityBucket
    ),
    queryFn: () => fetchAnalytics(projectId, filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const { data: subscription } = useSubscription();
  const analytics = data ?? (shouldUseInitialData ? initialData : undefined);

  const updateFilters = (nextFilters: AnalyticsFilters) => {
    setFilters(nextFilters);
    const params = buildFilterSearchParams(searchParams, nextFilters);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const emptyMessage = buildAnalyticsEmptyMessage(analytics?.filters ?? filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2 lg:flex">
          <Select
            value={filters.outcome}
            onValueChange={(value) =>
              updateFilters({
                ...filters,
                outcome: value as TicketOutcomeFilter,
              })
            }
          >
            <SelectTrigger className="w-full lg:w-[180px]" data-testid="analytics-outcome-filter">
              <SelectValue placeholder="Outcome" />
            </SelectTrigger>
            <SelectContent>
              {OUTCOME_OPTIONS.map((outcome) => (
                <SelectItem key={outcome} value={outcome}>
                  {getOutcomeLabel(outcome)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.agent}
            onValueChange={(value) =>
              updateFilters({
                ...filters,
                agent: value as AgentFilter,
              })
            }
          >
            <SelectTrigger className="w-full lg:w-[180px]" data-testid="analytics-agent-filter">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              {(analytics?.availableAgents ?? initialData.availableAgents).map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.command}
            onValueChange={(value) =>
              updateFilters({
                ...filters,
                command: value,
              })
            }
          >
            <SelectTrigger className="w-full lg:w-[180px]" data-testid="analytics-command-filter">
              <SelectValue placeholder="Command" />
            </SelectTrigger>
            <SelectContent>
              {COMMAND_OPTIONS.map((command) => (
                <SelectItem key={command} value={command}>
                  {command === 'all' ? 'All commands' : command}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.workflowType}
            onValueChange={(value) =>
              updateFilters({
                ...filters,
                workflowType: value as AnalyticsFilters['workflowType'],
              })
            }
          >
            <SelectTrigger className="w-full lg:w-[180px]" data-testid="analytics-workflow-filter">
              <SelectValue placeholder="Workflow" />
            </SelectTrigger>
            <SelectContent>
              {WORKFLOW_OPTIONS.map((workflowType) => (
                <SelectItem key={workflowType} value={workflowType}>
                  {workflowType === 'all' ? 'All workflows' : workflowType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.qualityBucket}
            onValueChange={(value) =>
              updateFilters({
                ...filters,
                qualityBucket: value as AnalyticsFilters['qualityBucket'],
              })
            }
          >
            <SelectTrigger className="w-full lg:w-[180px]" data-testid="analytics-quality-filter">
              <SelectValue placeholder="Quality bucket" />
            </SelectTrigger>
            <SelectContent>
              {QUALITY_BUCKET_OPTIONS.map((qualityBucket) => (
                <SelectItem key={qualityBucket} value={qualityBucket}>
                  {qualityBucket === 'all' ? 'All quality buckets' : qualityBucket}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <TimeRangeSelector
          value={filters.range}
          onChange={(range) =>
            updateFilters({
              ...filters,
              range,
            })
          }
        />
      </div>

      {analytics ? (
        <>
          <OverviewCards metrics={analytics.overview} />

          {!analytics.hasData && (
            <EmptyState
              title="No Matching Job Analytics"
              description={`${emptyMessage} Completion cards still reflect the active period.`}
            />
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="md:col-span-2">
              <CostOverTimeChart data={analytics.costOverTime} emptyMessage={emptyMessage} />
            </div>

            <div className="lg:col-span-1">
              <CostByStageChart data={analytics.costByStage} emptyMessage={emptyMessage} />
            </div>

            <div>
              <TokenUsageChart data={analytics.tokenUsage} emptyMessage={emptyMessage} />
            </div>

            <div>
              <CacheEfficiencyChart data={analytics.cacheEfficiency} emptyMessage={emptyMessage} />
            </div>

            <div>
              <TopToolsChart data={analytics.topTools} emptyMessage={emptyMessage} />
            </div>

            <div>
              <WorkflowDistributionChart
                data={analytics.workflowDistribution}
                emptyMessage={`No workflow distribution for ${getAgentLabel(
                  analytics.filters.agent
                )} in this selection.`}
              />
            </div>

            <div className="md:col-span-2">
              <VelocityChart data={analytics.velocity} emptyMessage={emptyMessage} />
            </div>

            <div className="md:col-span-2">
              <ContextPeakDistributionChart
                data={analytics.context.peakDistribution}
                emptyMessage={NO_CONTEXT_EMPTY_MESSAGE}
              />
            </div>

            <div className="lg:col-span-1">
              <ContextQualityBucketChart
                data={analytics.context.byQualityBucket}
                emptyMessage={
                  analytics.context.excludedMissingQualityScoreCount > 0
                    ? `${analytics.context.excludedMissingQualityScoreCount} jobs are excluded because they do not have a quality score.`
                    : NO_CONTEXT_EMPTY_MESSAGE
                }
              />
            </div>

            {subscription?.limits.advancedAnalytics && analytics.qualityScore && (
              <>
                <div className="md:col-span-2">
                  <QualityScoreTrendChart
                    data={analytics.qualityScore.scoreTrend}
                    emptyMessage={emptyMessage}
                  />
                </div>

                <div className="lg:col-span-1">
                  <DimensionComparisonChart
                    data={analytics.qualityScore.dimensionComparison}
                    emptyMessage={emptyMessage}
                  />
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          title={isLoading ? 'Loading analytics' : 'Analytics unavailable'}
          description={
            isLoading ? 'Refreshing dashboard data for the current filters.' : emptyMessage
          }
        />
      )}

      {subscription && !subscription.limits.advancedAnalytics && (
        <UpgradePrompt
          title="Advanced Analytics"
          description="Unlock advanced analytics including custom reports, trend analysis, and team performance metrics. Available on the Team plan."
        />
      )}
    </div>
  );
}

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import type { AnalyticsData, AnalyticsFilters } from '@/lib/analytics/types';

const pushMock = vi.fn();
const mockUseSubscription = vi.fn(() => ({ data: { limits: { advancedAnalytics: true } } }));
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/hooks/use-subscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock('@/components/billing/upgrade-prompt', () => ({
  UpgradePrompt: () => null,
}));

vi.mock('@/components/ui/select', () => {
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );

  const SelectTrigger = ({
    value,
    options,
    onValueChange,
    'data-testid': dataTestId,
  }: {
    value?: string;
    options?: React.ReactNode[];
    onValueChange?: (value: string) => void;
    'data-testid'?: string;
  }) => (
    <select
      data-testid={dataTestId}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {options}
    </select>
  );

  function collectOptions(children: React.ReactNode): React.ReactNode[] {
    return React.Children.toArray(children).flatMap((child) => {
      if (!React.isValidElement(child)) {
        return [];
      }

      if (child.type === SelectItem) {
        return [child];
      }

      return collectOptions(child.props.children);
    });
  }

  return {
    Select: ({
      value,
      onValueChange,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: React.ReactNode;
    }) => {
      const options = collectOptions(children);

      return (
        <>
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child) || child.type !== SelectTrigger) {
              return null;
            }

            return React.cloneElement(child, {
              value,
              onValueChange,
              options,
            });
          })}
        </>
      );
    },
    SelectTrigger,
    SelectValue: () => null,
    SelectContent: () => null,
    SelectItem,
  };
});

vi.mock('@/components/analytics/time-range-selector', () => ({
  TimeRangeSelector: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: '7d' | '30d' | '90d' | 'all') => void;
  }) => (
    <label>
      <span>Time Range</span>
      <select
        data-testid="analytics-range-filter"
        value={value}
        onChange={(event) => onChange(event.target.value as '7d' | '30d' | '90d' | 'all')}
      >
        <option value="7d">7d</option>
        <option value="30d">30d</option>
        <option value="90d">90d</option>
        <option value="all">all</option>
      </select>
    </label>
  ),
}));

vi.mock('@/components/analytics/cost-over-time-chart', () => ({
  CostOverTimeChart: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div>{emptyMessage ?? 'cost-over-time'}</div>
  ),
}));

vi.mock('@/components/analytics/cost-by-stage-chart', () => ({
  CostByStageChart: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div>{emptyMessage ?? 'cost-by-stage'}</div>
  ),
}));

vi.mock('@/components/analytics/token-usage-chart', () => ({
  TokenUsageChart: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div>{emptyMessage ?? 'token-usage'}</div>
  ),
}));

vi.mock('@/components/analytics/cache-efficiency-chart', () => ({
  CacheEfficiencyChart: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div>{emptyMessage ?? 'cache-efficiency'}</div>
  ),
}));

vi.mock('@/components/analytics/top-tools-chart', () => ({
  TopToolsChart: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div>{emptyMessage ?? 'top-tools'}</div>
  ),
}));

vi.mock('@/components/analytics/workflow-distribution-chart', () => ({
  WorkflowDistributionChart: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div>{emptyMessage ?? 'workflow-distribution'}</div>
  ),
}));

vi.mock('@/components/analytics/velocity-chart', () => ({
  VelocityChart: ({ emptyMessage }: { emptyMessage?: string }) => (
    <div>{emptyMessage ?? 'velocity'}</div>
  ),
}));

function makeAnalyticsData(filters: Partial<AnalyticsFilters> = {}, overrides: Partial<AnalyticsData> = {}): AnalyticsData {
  const resolvedFilters: AnalyticsFilters = {
    range: filters.range ?? '30d',
    outcome: filters.outcome ?? 'shipped',
    agent: filters.agent ?? 'all',
  };

  return {
    overview: {
      totalCost: 10,
      costTrend: 20,
      successRate: 80,
      avgDuration: 1000,
      ticketsShipped: { count: resolvedFilters.outcome === 'closed' ? 0 : 2, label: 'Last 30 days' },
      ticketsClosed: { count: resolvedFilters.outcome === 'shipped' ? 0 : 1, label: 'Last 30 days' },
    },
    costOverTime: [{ date: '2026-03-10', cost: 10 }],
    costByStage: [{ stage: 'BUILD', cost: 10, percentage: 100 }],
    tokenUsage: { inputTokens: 100, outputTokens: 50, cacheTokens: 25 },
    cacheEfficiency: {
      totalTokens: 175,
      cacheTokens: 25,
      savingsPercentage: 14.3,
      estimatedSavingsUsd: 0.2,
    },
    topTools: [{ tool: 'Read', count: 2 }],
    workflowDistribution: [{ type: 'FULL', count: 1, percentage: 100 }],
    velocity: [{ week: '2026-W10', ticketsShipped: 1 }],
    filters: resolvedFilters,
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 3, isDefault: true },
      { value: 'CLAUDE', label: 'Claude', jobCount: 2, isDefault: false },
      { value: 'CODEX', label: 'Codex', jobCount: 1, isDefault: false },
    ],
    generatedAt: '2026-03-14T00:00:00.000Z',
    jobCount: 3,
    hasData: true,
    ...overrides,
  };
}

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockSearchParams.delete('range');
    mockSearchParams.delete('outcome');
    mockSearchParams.delete('agent');
    mockUseSubscription.mockReturnValue({ data: { limits: { advancedAnalytics: true } } });
    vi.restoreAllMocks();
  });

  it('hydrates default filter state from initial analytics payload', () => {
    renderWithProviders(<AnalyticsDashboard projectId={1} initialData={makeAnalyticsData()} />);

    expect(screen.getByTestId('analytics-outcome-filter')).toHaveValue('shipped');
    expect(screen.getByTestId('analytics-agent-filter')).toHaveValue('all');
    expect(screen.getByTestId('analytics-range-filter')).toHaveValue('30d');
    expect(screen.getByText('Tickets Shipped')).toBeInTheDocument();
  });

  it('updates outcome filter, query params, and replaces stale values after a refetch', async () => {
    const closedData = makeAnalyticsData(
      { outcome: 'closed' },
      {
        overview: {
          totalCost: 3.5,
          costTrend: -10,
          successRate: 50,
          avgDuration: 2000,
          ticketsShipped: { count: 0, label: 'Last 30 days' },
          ticketsClosed: { count: 1, label: 'Last 30 days' },
        },
      }
    );

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(closedData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    renderWithProviders(<AnalyticsDashboard projectId={1} initialData={makeAnalyticsData()} />);

    await act(async () => {
      const select = screen.getByTestId('analytics-outcome-filter');
      fireEvent.change(select, { target: { value: 'closed' } });
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/analytics?range=30d&outcome=closed&agent=all'
      )
    );

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('?range=30d&outcome=closed&agent=all', { scroll: false }));
    await waitFor(() => expect(screen.getByText('50.0%')).toBeInTheDocument());
    expect(screen.queryByText('80.0%')).not.toBeInTheDocument();
  });

  it('renders available agent options and filter-aware empty state while keeping overview cards visible', () => {
    renderWithProviders(
      <AnalyticsDashboard
        projectId={1}
        initialData={makeAnalyticsData(
          { outcome: 'closed', agent: 'CODEX' },
          {
            hasData: false,
            jobCount: 0,
            costOverTime: [],
            costByStage: [],
            tokenUsage: { inputTokens: 0, outputTokens: 0, cacheTokens: 0 },
            cacheEfficiency: {
              totalTokens: 0,
              cacheTokens: 0,
              savingsPercentage: 0,
              estimatedSavingsUsd: 0,
            },
            topTools: [],
            workflowDistribution: [],
            velocity: [],
          }
        )}
      />
    );

    const agentSelect = screen.getByTestId('analytics-agent-filter');
    expect(agentSelect).toHaveValue('CODEX');
    expect(screen.getByRole('option', { name: 'All agents' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Claude' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Codex' })).toBeInTheDocument();

    expect(screen.getByText('Tickets Closed')).toBeInTheDocument();
    expect(screen.getByText('No Matching Job Analytics')).toBeInTheDocument();
    expect(
      screen.getByText(/completion cards still reflect the active period/i)
    ).toBeInTheDocument();
  });

  it('updates completion-card labels when the active range changes', async () => {
    const allTimeData = makeAnalyticsData(
      { range: 'all', outcome: 'all-completed' },
      {
        overview: {
          totalCost: 20,
          costTrend: 0,
          successRate: 100,
          avgDuration: 1200,
          ticketsShipped: { count: 5, label: 'All time' },
          ticketsClosed: { count: 4, label: 'All time' },
        },
      }
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(allTimeData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    renderWithProviders(
      <AnalyticsDashboard
        projectId={1}
        initialData={makeAnalyticsData({ outcome: 'all-completed' })}
      />
    );

    const rangeSelect = screen.getByTestId('analytics-range-filter');
    await act(async () => {
      fireEvent.change(rangeSelect, { target: { value: 'all' } });
    });

    await waitFor(() => expect(screen.getAllByText('All time')).toHaveLength(2));
  });
});

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import type { AnalyticsData } from '@/lib/analytics/types';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/hooks/use-subscription', () => ({
  useSubscription: () => ({ data: null }),
}));

vi.mock('@/components/analytics/cost-over-time-chart', () => ({
  CostOverTimeChart: () => <div>Cost Over Time Chart</div>,
}));

vi.mock('@/components/analytics/cost-by-stage-chart', () => ({
  CostByStageChart: () => <div>Cost By Stage Chart</div>,
}));

vi.mock('@/components/analytics/token-usage-chart', () => ({
  TokenUsageChart: () => <div>Token Usage Chart</div>,
}));

vi.mock('@/components/analytics/cache-efficiency-chart', () => ({
  CacheEfficiencyChart: () => <div>Cache Efficiency Chart</div>,
}));

vi.mock('@/components/analytics/top-tools-chart', () => ({
  TopToolsChart: () => <div>Top Tools Chart</div>,
}));

vi.mock('@/components/analytics/workflow-distribution-chart', () => ({
  WorkflowDistributionChart: () => <div>Workflow Distribution Chart</div>,
}));

vi.mock('@/components/analytics/velocity-chart', () => ({
  VelocityChart: () => <div>Velocity Chart</div>,
}));

const baseAnalytics: AnalyticsData = {
  filters: {
    timeRange: '30d',
    statusScope: 'shipped',
    agentScope: 'all',
    periodLabel: 'Last 30 days',
  },
  availableAgents: [
    { value: 'CLAUDE', label: 'Claude', jobCount: 2 },
    { value: 'CODEX', label: 'Codex', jobCount: 1 },
  ],
  overview: {
    totalCost: 12.5,
    costTrend: 5.1,
    successRate: 90,
    avgDuration: 5000,
    ticketsShipped: 2,
    ticketsClosed: 1,
    ticketPeriodLabel: 'Last 30 days',
  },
  costOverTime: [{ date: '2026-03-10', cost: 12.5 }],
  costByStage: [{ stage: 'BUILD', cost: 12.5, percentage: 100 }],
  tokenUsage: { inputTokens: 100, outputTokens: 50, cacheTokens: 20 },
  cacheEfficiency: {
    totalTokens: 170,
    cacheTokens: 20,
    savingsPercentage: 11.8,
    estimatedSavingsUsd: 0.01,
  },
  topTools: [{ tool: 'Edit', count: 2 }],
  workflowDistribution: [{ type: 'FULL', count: 2, percentage: 100 }],
  velocity: [{ week: '2026-W10', ticketsShipped: 2 }],
  timeRange: '30d',
  generatedAt: '2026-03-13T00:00:00.000Z',
  jobCount: 2,
  hasData: true,
};

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    push.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
      configurable: true,
      value: vi.fn(() => false),
    });
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => baseAnalytics,
      }))
    );
  });

  it('renders time range, status, and agent controls', () => {
    renderWithProviders(<AnalyticsDashboard projectId={1} initialData={baseAnalytics} />);

    expect(screen.getByRole('combobox', { name: 'Status scope' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Agent scope' })).toBeInTheDocument();
    expect(screen.getByText('Tickets Closed')).toBeInTheDocument();
  });

  it('pushes updated query params when the status filter changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AnalyticsDashboard projectId={1} initialData={baseAnalytics} />);

    await user.click(screen.getByRole('combobox', { name: 'Status scope' }));
    await user.click(screen.getByText('Closed only'));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('?range=30d&statusScope=closed&agentScope=all', {
        scroll: false,
      });
    });
  });

  it('renders filter-aware empty-state messaging', () => {
    renderWithProviders(
      <AnalyticsDashboard
        projectId={1}
        initialData={{
          ...baseAnalytics,
          hasData: false,
          filters: {
            timeRange: '7d',
            statusScope: 'closed',
            agentScope: 'CODEX',
            periodLabel: 'Last 7 days',
          },
          overview: {
            ...baseAnalytics.overview,
            ticketsShipped: 0,
            ticketsClosed: 0,
            ticketPeriodLabel: 'Last 7 days',
          },
          costOverTime: [],
          costByStage: [],
          topTools: [],
          workflowDistribution: [],
          velocity: [],
          jobCount: 0,
        }}
      />
    );

    expect(screen.getByText(/No jobs or tickets matched Closed only in Last 7 days for CODEX/i)).toBeInTheDocument();
  });
});

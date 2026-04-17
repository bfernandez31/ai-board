import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import type { HeatmapData } from '@/lib/activity-heatmap/types';

const pushMock = vi.fn();
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
      if (!React.isValidElement(child)) return [];
      if (child.type === SelectItem) return [child];
      return collectOptions((child.props as { children?: React.ReactNode }).children);
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
            if (!React.isValidElement(child) || child.type !== SelectTrigger) return null;
            return React.cloneElement(child as React.ReactElement, {
              value,
              onValueChange,
              options,
            });
          })}
        </>
      );
    },
    SelectTrigger,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem,
    SelectValue: () => null,
  };
});

function baseHeatmap(overrides: Partial<HeatmapData> = {}): HeatmapData {
  return {
    days: [
      { date: '2026-01-05', jobCount: 4, totalCost: 2.5, hasCost: true, ticketsShipped: 1 },
      { date: '2026-01-06', jobCount: 0, totalCost: 0, hasCost: false, ticketsShipped: 0 },
    ],
    startDate: '2025-04-18',
    endDate: '2026-04-17',
    totalJobs: 4,
    totalShipped: 1,
    availableAgents: [{ value: 'all', label: 'All agents', jobCount: 4 }],
    availablePeriods: ['last-12-months', 'year-2026', 'year-2025'],
    filters: { period: 'last-12-months', agent: 'all' },
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it('renders the counter with jobs and tickets shipped', () => {
    renderWithProviders(<ActivityHeatmap initialData={baseHeatmap()} />);
    const counter = screen.getByTestId('activity-heatmap-counter');
    expect(counter).toHaveTextContent('4 jobs');
    expect(counter).toHaveTextContent('1 tickets shipped');
    expect(counter).toHaveTextContent('the last year');
  });

  it('hides the agent filter when only 1 distinct agent is present', () => {
    renderWithProviders(<ActivityHeatmap initialData={baseHeatmap()} />);
    expect(screen.queryByTestId('heatmap-agent-filter')).not.toBeInTheDocument();
  });

  it('shows the agent filter when multiple agents are present', () => {
    const data = baseHeatmap({
      availableAgents: [
        { value: 'all', label: 'All agents', jobCount: 6 },
        { value: 'CLAUDE', label: 'Claude', jobCount: 4 },
        { value: 'CODEX', label: 'Codex', jobCount: 2 },
      ],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    expect(screen.getByTestId('heatmap-agent-filter')).toBeInTheDocument();
  });

  it('shows year selector when account is older than this year', () => {
    renderWithProviders(<ActivityHeatmap initialData={baseHeatmap()} />);
    expect(screen.getByTestId('heatmap-period-filter')).toBeInTheDocument();
  });

  it('hides year selector when only last-12-months is available', () => {
    const data = baseHeatmap({ availablePeriods: ['last-12-months'] });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    expect(screen.queryByTestId('heatmap-period-filter')).not.toBeInTheDocument();
  });

  it('renders the empty state when there is no activity', () => {
    const data = baseHeatmap({
      days: [],
      totalJobs: 0,
      totalShipped: 0,
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    expect(screen.getByTestId('activity-heatmap-empty')).toHaveTextContent(
      'No activity to show yet — your AI work will appear here'
    );
  });

  it('renders the legend even in empty state', () => {
    const data = baseHeatmap({ days: [], totalJobs: 0, totalShipped: 0 });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });
});

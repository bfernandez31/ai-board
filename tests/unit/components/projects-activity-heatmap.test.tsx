import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ProjectsActivityHeatmap } from '@/components/heatmap/projects-activity-heatmap';
import type { HeatmapData, HeatmapFilters } from '@/lib/heatmap/types';
import { fillDateRange, toISODate } from '@/lib/heatmap/aggregations';

const replaceMock = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: replaceMock,
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
            if (!React.isValidElement(child) || child.type !== SelectTrigger) return null;
            return React.cloneElement(child, { value, onValueChange, options });
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

function makeHeatmapData(
  filters: Partial<HeatmapFilters> = {},
  overrides: Partial<HeatmapData> = {}
): HeatmapData {
  const resolvedFilters: HeatmapFilters = {
    period: filters.period ?? 'last-12-months',
    agent: filters.agent ?? 'all',
  };

  const start = new Date(Date.UTC(2025, 3, 18));
  const end = new Date(Date.UTC(2026, 3, 17));
  const days = fillDateRange(start, end).map((date) => ({
    date,
    jobCount: 0,
    totalCost: null as number | null,
    ticketsShipped: 0,
  }));

  // Seed some activity so the grid renders
  const activeDay = days.find((d) => d.date === '2026-03-15');
  if (activeDay) {
    activeDay.jobCount = 4;
    activeDay.totalCost = 1.23;
    activeDay.ticketsShipped = 1;
  }

  return {
    days,
    periodStart: toISODate(start),
    periodEnd: toISODate(end),
    totalJobs: 4,
    totalShipped: 1,
    filters: resolvedFilters,
    periodOptions: [
      { value: 'last-12-months', label: 'Last 12 months' },
      { value: '2025', label: '2025' },
    ],
    agentOptions: [
      { value: 'all', label: 'All agents' },
      { value: 'CLAUDE', label: 'Claude' },
      { value: 'CODEX', label: 'Codex' },
    ],
    generatedAt: new Date('2026-04-17T00:00:00Z').toISOString(),
    ...overrides,
  };
}

describe('ProjectsActivityHeatmap', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    Array.from(mockSearchParams.keys()).forEach((key) => mockSearchParams.delete(key));
    vi.restoreAllMocks();
  });

  it('renders the summary line using the shipped and job totals from initial data', () => {
    renderWithProviders(<ProjectsActivityHeatmap initialData={makeHeatmapData()} />);

    expect(screen.getByTestId('heatmap-summary')).toHaveTextContent(
      '4 jobs · 1 ticket shipped in the last year'
    );
  });

  it('shows the empty state message when the whole period has no activity', () => {
    renderWithProviders(
      <ProjectsActivityHeatmap
        initialData={makeHeatmapData({}, {
          totalJobs: 0,
          totalShipped: 0,
          days: fillDateRange(new Date(Date.UTC(2025, 3, 18)), new Date(Date.UTC(2026, 3, 17))).map(
            (date) => ({ date, jobCount: 0, totalCost: null, ticketsShipped: 0 })
          ),
        })}
      />
    );

    expect(screen.getByTestId('heatmap-empty')).toHaveTextContent(
      'No activity to show yet — your AI work will appear here'
    );
  });

  it('hides the agent filter when only 0 or 1 distinct agents are present', () => {
    renderWithProviders(
      <ProjectsActivityHeatmap
        initialData={makeHeatmapData({}, {
          agentOptions: [
            { value: 'all', label: 'All agents' },
            { value: 'CLAUDE', label: 'Claude' },
          ],
        })}
      />
    );

    expect(screen.queryByTestId('heatmap-agent-filter')).not.toBeInTheDocument();
  });

  it('hides the period filter when the account is too new for calendar years', () => {
    renderWithProviders(
      <ProjectsActivityHeatmap
        initialData={makeHeatmapData({}, {
          periodOptions: [{ value: 'last-12-months', label: 'Last 12 months' }],
        })}
      />
    );

    expect(screen.queryByTestId('heatmap-period-filter')).not.toBeInTheDocument();
  });

  it('updates URL params and refetches when the user picks a specific year', async () => {
    const yearData = makeHeatmapData(
      { period: '2025' },
      { totalJobs: 10, totalShipped: 3 }
    );

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(yearData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    renderWithProviders(<ProjectsActivityHeatmap initialData={makeHeatmapData()} />);

    await act(async () => {
      const select = screen.getByTestId('heatmap-period-filter');
      fireEvent.change(select, { target: { value: '2025' } });
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/heatmap?period=2025&agent=all')
    );
    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith('?heatmapPeriod=2025', { scroll: false })
    );
    await waitFor(() =>
      expect(screen.getByTestId('heatmap-summary')).toHaveTextContent(
        '10 jobs · 3 tickets shipped in 2025'
      )
    );
  });

  it('rehydrates the filter state from URL query params on first render', () => {
    mockSearchParams.set('heatmapAgent', 'CODEX');
    const initialData = makeHeatmapData({ agent: 'CODEX' });

    renderWithProviders(<ProjectsActivityHeatmap initialData={initialData} />);

    expect(screen.getByTestId('heatmap-agent-filter')).toHaveValue('CODEX');
  });
});

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import { ProjectsActivityHeatmap } from '@/components/projects/projects-activity-heatmap';
import type { ProjectsActivityHeatmapResponse } from '@/app/lib/types/project';

const pushMock = vi.fn();
const mockSearchParams = new URLSearchParams();
const mockUseProjectsActivityHeatmap = vi.fn();

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

vi.mock('@/app/lib/hooks/queries/use-projects-activity-heatmap', () => ({
  useProjectsActivityHeatmap: (args: unknown) => mockUseProjectsActivityHeatmap(args),
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

function makeHeatmapData(
  overrides: Partial<ProjectsActivityHeatmapResponse> = {}
): ProjectsActivityHeatmapResponse {
  return {
    filters: {
      period: 'last-12-months',
      year: null,
      agent: 'all',
    },
    periodOptions: [
      {
        value: 'last-12-months',
        label: 'Last 12 months',
        kind: 'rolling',
        rangeStart: '2025-04-15',
        rangeEnd: '2026-04-15',
      },
      {
        value: 'year:2026',
        label: '2026',
        kind: 'calendar-year',
        rangeStart: '2026-01-01',
        rangeEnd: '2026-12-31',
      },
    ],
    agentOptions: [
      { value: 'all', label: 'All' },
      { value: 'CLAUDE', label: 'Claude' },
      { value: 'CODEX', label: 'Codex' },
    ],
    summary: {
      totalJobs: 4,
      totalShippedTickets: 2,
      summaryLabel: '4 jobs · 2 tickets shipped in the last 12 months',
    },
    days: [
      {
        date: '2026-04-13',
        weekIndex: 0,
        weekdayIndex: 1,
        monthLabel: 'Apr',
        jobCount: 0,
        shippedTicketCount: 0,
        costUsd: null,
        intensityLevel: 0,
        shippedTickets: [],
      },
      {
        date: '2026-04-15',
        weekIndex: 0,
        weekdayIndex: 3,
        monthLabel: null,
        jobCount: 4,
        shippedTicketCount: 2,
        costUsd: 2.31,
        intensityLevel: 4,
        shippedTickets: [
          { ticketId: 1, ticketKey: 'AIB-653', title: 'Heatmap work' },
          { ticketId: 2, ticketKey: 'AIB-700', title: 'Second ship' },
        ],
      },
    ],
    legendLevels: [0, 1, 2, 3, 4],
    hasActivity: true,
    generatedAt: '2026-04-15T12:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectsActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockSearchParams.delete('period');
    mockSearchParams.delete('year');
    mockSearchParams.delete('agent');
    mockUseProjectsActivityHeatmap.mockReturnValue({
      data: makeHeatmapData(),
      isFetching: false,
    });
  });

  it('renders first-render summary text, legend levels, and in-period day cells', () => {
    renderWithProviders(<ProjectsActivityHeatmap initialData={makeHeatmapData()} />);

    expect(screen.getByText('4 jobs · 2 tickets shipped in the last 12 months')).toBeInTheDocument();
    expect(screen.getByText('AI activity')).toBeInTheDocument();
    expect(screen.getByText('Less activity')).toBeInTheDocument();
    expect(screen.getByText('More activity')).toBeInTheDocument();
    expect(screen.getByTestId('projects-activity-legend-0')).toBeInTheDocument();
    expect(screen.getByTestId('projects-activity-legend-4')).toBeInTheDocument();
    expect(screen.getByTestId('projects-activity-cell-2026-04-13')).toBeInTheDocument();
    expect(screen.getByTestId('projects-activity-cell-2026-04-15')).toBeInTheDocument();
    expect(screen.getByText('Apr')).toBeInTheDocument();
  });

  it('renders the empty state while keeping controls and legend visible', () => {
    const emptyData = makeHeatmapData({
      summary: {
        totalJobs: 0,
        totalShippedTickets: 0,
        summaryLabel: '0 jobs · 0 tickets shipped in the last 12 months',
      },
      days: [
        {
          date: '2026-04-13',
          weekIndex: 0,
          weekdayIndex: 1,
          monthLabel: 'Apr',
          jobCount: 0,
          shippedTicketCount: 0,
          costUsd: null,
          intensityLevel: 0,
          shippedTickets: [],
        },
      ],
      hasActivity: false,
    });

    mockUseProjectsActivityHeatmap.mockReturnValue({
      data: emptyData,
      isFetching: false,
    });

    renderWithProviders(<ProjectsActivityHeatmap initialData={emptyData} />);

    expect(screen.getByTestId('projects-activity-empty-state')).toHaveTextContent(
      'No activity to show yet — your AI work will appear here.'
    );
    expect(screen.getByTestId('projects-activity-period-filter')).toBeInTheDocument();
    expect(screen.getByTestId('projects-activity-legend-0')).toBeInTheDocument();
  });

  it('updates the URL when the period and agent filters change', async () => {
    renderWithProviders(<ProjectsActivityHeatmap initialData={makeHeatmapData()} />);

    await userEvent.selectOptions(
      screen.getByTestId('projects-activity-period-filter'),
      'year:2026'
    );
    await userEvent.selectOptions(
      screen.getByTestId('projects-activity-agent-filter'),
      'CODEX'
    );

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('?period=year&year=2026&agent=all', {
        scroll: false,
      });
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenLastCalledWith('?period=year&year=2026&agent=CODEX', {
        scroll: false,
      });
    });
  });

  it('renders day details on click, including shipped tickets and cost', async () => {
    renderWithProviders(<ProjectsActivityHeatmap initialData={makeHeatmapData()} />);

    await userEvent.click(screen.getByTestId('projects-activity-cell-2026-04-15'));

    expect(screen.getByText('April 15, 2026')).toBeInTheDocument();
    expect(screen.getByText('4 jobs')).toBeInTheDocument();
    expect(screen.getByText('2 tickets shipped')).toBeInTheDocument();
    expect(screen.getByText('$2.31 cost')).toBeInTheDocument();
    expect(screen.getByText('AIB-653: Heatmap work')).toBeInTheDocument();
  });

  it('omits the cost line when a day has no recorded cost', async () => {
    const noCostData = makeHeatmapData({
      days: [
        {
          date: '2026-04-15',
          weekIndex: 0,
          weekdayIndex: 3,
          monthLabel: 'Apr',
          jobCount: 1,
          shippedTicketCount: 1,
          costUsd: null,
          intensityLevel: 1,
          shippedTickets: [{ ticketId: 1, ticketKey: 'AIB-653', title: 'Heatmap work' }],
        },
      ],
    });

    mockUseProjectsActivityHeatmap.mockReturnValue({
      data: noCostData,
      isFetching: false,
    });

    renderWithProviders(<ProjectsActivityHeatmap initialData={noCostData} />);
    await userEvent.click(screen.getByTestId('projects-activity-cell-2026-04-15'));

    expect(screen.queryByText(/\$.* cost/)).not.toBeInTheDocument();
  });

  it('keeps visible content on background refresh', () => {
    mockUseProjectsActivityHeatmap.mockReturnValue({
      data: makeHeatmapData(),
      isFetching: true,
    });

    renderWithProviders(<ProjectsActivityHeatmap initialData={makeHeatmapData()} />);

    expect(screen.getByText('4 jobs · 2 tickets shipped in the last 12 months')).toBeInTheDocument();
    expect(screen.getByText('Refreshing activity…')).toBeInTheDocument();
    expect(screen.getByTestId('projects-activity-cell-2026-04-15')).toBeInTheDocument();
  });
});

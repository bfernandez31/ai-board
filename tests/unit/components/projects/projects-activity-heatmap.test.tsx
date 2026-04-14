import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ProjectsActivityHeatmap } from '@/components/projects/projects-activity-heatmap';
import type { ProjectsActivityHeatmapResponse } from '@/lib/projects/activity-heatmap-types';

const pushMock = vi.fn();
const fetchMock = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.stubGlobal('fetch', fetchMock);

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

vi.mock('@/components/ui/tooltip', async () => {
  const ReactModule = await import('react');
  const TooltipContext = ReactModule.createContext<{
    open: boolean;
    setOpen: (value: boolean) => void;
  } | null>(null);

  function Tooltip({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = ReactModule.useState(false);

    return (
      <TooltipContext.Provider value={{ open, setOpen }}>
        {children}
      </TooltipContext.Provider>
    );
  }

  function TooltipTrigger({
    asChild,
    children,
  }: {
    asChild?: boolean;
    children: React.ReactElement;
  }) {
    const context = ReactModule.useContext(TooltipContext);

    if (!context || !asChild || !ReactModule.isValidElement(children)) {
      return children;
    }

    return ReactModule.cloneElement(children, {
      onMouseEnter: () => context.setOpen(true),
      onMouseLeave: () => context.setOpen(false),
      onFocus: () => context.setOpen(true),
      onBlur: () => context.setOpen(false),
    });
  }

  function TooltipContent({ children }: { children: React.ReactNode }) {
    const context = ReactModule.useContext(TooltipContext);
    return context?.open ? <div role="tooltip">{children}</div> : null;
  }

  return {
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Tooltip,
    TooltipTrigger,
    TooltipContent,
  };
});

function makeHeatmapDay(
  date: string,
  overrides: Partial<ProjectsActivityHeatmapResponse['days'][number]> = {}
): ProjectsActivityHeatmapResponse['days'][number] {
  const day = new Date(`${date}T00:00:00.000Z`);

  return {
    date,
    weekday: day.getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    weekIndex: 0,
    monthLabel: date.endsWith('-01') ? 'Jan' : null,
    jobCount: 0,
    ticketsShipped: 0,
    costUsd: 0,
    intensityLevel: 0,
    isInPrimaryRange: true,
    displayDate: day.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    ...overrides,
  };
}

function makeHeatmapResponse(
  overrides: Partial<ProjectsActivityHeatmapResponse> = {}
): ProjectsActivityHeatmapResponse {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, index + 1));
    return makeHeatmapDay(date.toISOString().slice(0, 10), {
      weekIndex: Math.floor(index / 7),
    });
  });

  days[1] = makeHeatmapDay('2026-01-02', {
    weekIndex: 0,
    jobCount: 2,
    ticketsShipped: 1,
    costUsd: 3.5,
    intensityLevel: 2,
  });

  return {
    view: {
      value: 'rolling-12m',
      label: 'Last 12 months',
      startDate: '2025-01-02',
      endDate: '2026-01-01',
      isDefault: true,
    },
    availableViews: [
      {
        value: 'rolling-12m',
        label: 'Last 12 months',
        startDate: '2025-01-02',
        endDate: '2026-01-01',
        isDefault: true,
      },
      {
        value: 'year-2025',
        label: '2025',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        isDefault: false,
      },
    ],
    filters: {
      agent: 'all',
    },
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 2, isDefault: true },
      { value: 'CLAUDE', label: 'Claude', jobCount: 2, isDefault: false },
      { value: 'CODEX', label: 'Codex', jobCount: 1, isDefault: false },
    ],
    summary: {
      jobCount: 2,
      ticketsShipped: 1,
      costUsd: 3.5,
      hasAnyActivity: true,
      rangeLabel: 'the last year',
    },
    legend: [
      { level: 0, label: 'No jobs', minJobs: 0, maxJobs: 0 },
      { level: 1, label: '1 job', minJobs: 1, maxJobs: 1 },
      { level: 2, label: '2 jobs', minJobs: 2, maxJobs: 2 },
      { level: 3, label: '3 jobs', minJobs: 3, maxJobs: 3 },
      { level: 4, label: '4+ jobs', minJobs: 4, maxJobs: null },
    ],
    days,
    generatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectsActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockReset();
    fetchMock.mockReset();
    mockSearchParams.delete('view');
    mockSearchParams.delete('agent');
  });

  it('renders the summary, legend, full cell grid, and zero-activity days', () => {
    renderWithProviders(<ProjectsActivityHeatmap initialData={makeHeatmapResponse()} />);

    expect(screen.getByText('Workspace activity')).toBeInTheDocument();
    expect(screen.getByText('2 jobs · 1 tickets shipped in the last year')).toBeInTheDocument();
    expect(screen.getByTestId('projects-activity-legend')).toBeInTheDocument();
    expect(screen.getAllByTestId('projects-activity-cell')).toHaveLength(14);
    expect(
      screen.getByLabelText('Jan 1, 2026: 0 jobs, 0 tickets shipped, $0.00 cost')
    ).toHaveAttribute('data-intensity', '0');
  });

  it('shows tooltip details for populated and empty days on hover and focus', async () => {
    renderWithProviders(<ProjectsActivityHeatmap initialData={makeHeatmapResponse()} />);

    const populatedCell = screen.getByLabelText(
      'Jan 2, 2026: 2 jobs, 1 tickets shipped, $3.50 cost'
    );

    fireEvent.mouseEnter(populatedCell);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Jan 2, 2026');
    expect(screen.getByRole('tooltip')).toHaveTextContent('2 jobs');
    expect(screen.getByRole('tooltip')).toHaveTextContent('1 tickets shipped');

    fireEvent.mouseLeave(populatedCell);

    const emptyCell = screen.getByLabelText(
      'Jan 1, 2026: 0 jobs, 0 tickets shipped, $0.00 cost'
    );

    fireEvent.focus(emptyCell);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('0 jobs');
    expect(screen.getByRole('tooltip')).toHaveTextContent('0 tickets shipped');
    expect(screen.getByRole('tooltip')).toHaveTextContent('$0.00 cost');
  });

  it('refetches when the user changes year or agent filters and keeps no-activity messaging visible', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () =>
        makeHeatmapResponse({
          view: {
            value: 'year-2025',
            label: '2025',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            isDefault: false,
          },
          filters: {
            agent: 'CODEX',
          },
          summary: {
            jobCount: 0,
            ticketsShipped: 0,
            costUsd: 0,
            hasAnyActivity: false,
            rangeLabel: '2025',
          },
        }),
    });

    renderWithProviders(<ProjectsActivityHeatmap initialData={makeHeatmapResponse()} />);

    fireEvent.change(screen.getByTestId('projects-activity-view-filter'), {
      target: { value: 'year-2025' },
    });
    fireEvent.change(screen.getByTestId('projects-activity-agent-filter'), {
      target: { value: 'CODEX' },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/projects/activity?view=year-2025&agent=CODEX');
    });

    expect(pushMock).toHaveBeenCalledWith('?view=year-2025&agent=CODEX', { scroll: false });

    await waitFor(() => {
      expect(screen.getByTestId('projects-activity-empty-state')).toBeInTheDocument();
    });
  });
});

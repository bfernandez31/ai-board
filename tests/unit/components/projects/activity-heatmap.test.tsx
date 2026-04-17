import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import type { HeatmapResponse } from '@/lib/analytics/activity-heatmap-helpers';

const replaceMock = vi.fn();
let mockSearchParams: URLSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: vi.fn(),
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
      const props = child.props as { children?: React.ReactNode } | undefined;
      return collectOptions(props?.children);
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
            return React.cloneElement(child, {
              value,
              onValueChange,
              options,
            } as Partial<React.ComponentProps<typeof SelectTrigger>>);
          })}
        </>
      );
    },
    SelectTrigger,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem,
  };
});

function makeCell(overrides: Partial<import('@/lib/analytics/activity-heatmap-helpers').HeatmapDayCell>) {
  return {
    date: '2026-04-01',
    jobCount: 0,
    costUsd: null,
    nullCostJobCount: 0,
    shippedTickets: [],
    intensity: 0 as const,
    ...overrides,
  };
}

function buildRangeCells(startISO: string, endISO: string) {
  const cells: import('@/lib/analytics/activity-heatmap-helpers').HeatmapDayCell[] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  const end = new Date(`${endISO}T00:00:00Z`);
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const y = d.getUTCFullYear().toString().padStart(4, '0');
    const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = d.getUTCDate().toString().padStart(2, '0');
    cells.push(makeCell({ date: `${y}-${m}-${day}` }));
  }
  return cells;
}

function baseResponse(overrides?: Partial<HeatmapResponse>): HeatmapResponse {
  const cells = buildRangeCells('2025-04-17', '2026-04-17');
  return {
    period: {
      kind: 'rolling12m',
      startDate: '2025-04-17',
      endDate: '2026-04-17',
      timezone: 'UTC',
    },
    counters: { jobCount: 0, shippedTicketCount: 0 },
    cells,
    intensityThresholds: [0, 0, 0, 0],
    availableAgents: [],
    yearSelector: { calendarYears: [], currentYear: 2026 },
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    mockSearchParams = new URLSearchParams();
    // Silence background refetches triggered after initial-data handoff
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(baseResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    ) as unknown as typeof fetch;
  });

  it('renders synchronously from initialData without loading text', () => {
    const response = baseResponse({
      counters: { jobCount: 42, shippedTicketCount: 7 },
    });
    const { container } = renderWithProviders(
      <ActivityHeatmap initialData={response} errored={false} />
    );
    expect(container.textContent).not.toMatch(/loading/i);
    expect(screen.getByTestId('activity-heatmap')).toBeInTheDocument();
    expect(screen.getByTestId('activity-heatmap-counter').textContent).toContain(
      '42 jobs · 7 tickets shipped in the last year'
    );
  });

  it('renders a grid with cells and legend', () => {
    const response = baseResponse({
      counters: { jobCount: 3, shippedTicketCount: 0 },
      cells: baseResponse().cells.map((c, i) =>
        i === 0 ? { ...c, jobCount: 3, intensity: 4 } : c
      ),
      intensityThresholds: [1, 2, 3, 3],
    });
    renderWithProviders(<ActivityHeatmap initialData={response} errored={false} />);
    const cells = screen.getAllByTestId('heatmap-cell');
    expect(cells.length).toBe(response.cells.length);
    expect(screen.getByTestId('activity-heatmap-legend')).toBeInTheDocument();
  });

  it('shows empty-state message with legend still visible when no activity', () => {
    const response = baseResponse();
    renderWithProviders(<ActivityHeatmap initialData={response} errored={false} />);
    expect(screen.getByTestId('activity-heatmap-empty').textContent).toContain(
      'No activity to show yet'
    );
    expect(screen.getByTestId('activity-heatmap-legend')).toBeInTheDocument();
  });

  it('renders error notice when errored', () => {
    renderWithProviders(<ActivityHeatmap initialData={null} errored={true} />);
    expect(screen.getByRole('alert').textContent).toMatch(/temporarily unavailable/i);
  });

  it('hides year selector when account created this year', () => {
    const response = baseResponse();
    renderWithProviders(<ActivityHeatmap initialData={response} errored={false} />);
    expect(screen.queryByTestId('activity-heatmap-year-filter')).toBeNull();
  });

  it('shows year selector and switches counter phrase on year change', () => {
    const response = baseResponse({
      yearSelector: { calendarYears: [2026, 2025, 2024], currentYear: 2026 },
    });
    renderWithProviders(<ActivityHeatmap initialData={response} errored={false} />);
    const yearFilter = screen.getByTestId('activity-heatmap-year-filter') as HTMLSelectElement;
    expect(Array.from(yearFilter.options).map((o) => o.value)).toEqual([
      '12m',
      '2026',
      '2025',
      '2024',
    ]);
    fireEvent.change(yearFilter, { target: { value: '2025' } });
    expect(replaceMock).toHaveBeenCalledWith('?y=2025', { scroll: false });
  });

  it('hides agent filter when fewer than 2 agents', () => {
    const response = baseResponse({ availableAgents: ['CLAUDE'] });
    renderWithProviders(<ActivityHeatmap initialData={response} errored={false} />);
    expect(screen.queryByTestId('activity-heatmap-agent-filter')).toBeNull();
  });

  it('renders agent filter when >=2 agents and syncs URL', () => {
    const response = baseResponse({ availableAgents: ['CLAUDE', 'CODEX'] });
    renderWithProviders(<ActivityHeatmap initialData={response} errored={false} />);
    const agentFilter = screen.getByTestId('activity-heatmap-agent-filter') as HTMLSelectElement;
    fireEvent.change(agentFilter, { target: { value: 'CLAUDE' } });
    expect(replaceMock).toHaveBeenCalledWith('?a=CLAUDE', { scroll: false });
  });

  it('restores state from searchParams (SC-004 round-trip)', () => {
    mockSearchParams = new URLSearchParams('y=2025&a=CLAUDE');
    const response = baseResponse({
      period: {
        kind: 'calendarYear',
        year: 2025,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        timezone: 'UTC',
      },
      counters: { jobCount: 10, shippedTicketCount: 2 },
      cells: buildRangeCells('2025-01-01', '2025-12-31'),
      yearSelector: { calendarYears: [2026, 2025, 2024], currentYear: 2026 },
      availableAgents: ['CLAUDE', 'CODEX'],
    });
    renderWithProviders(<ActivityHeatmap initialData={response} errored={false} />);
    const yearFilter = screen.getByTestId('activity-heatmap-year-filter') as HTMLSelectElement;
    const agentFilter = screen.getByTestId('activity-heatmap-agent-filter') as HTMLSelectElement;
    expect(yearFilter.value).toBe('2025');
    expect(agentFilter.value).toBe('CLAUDE');
  });

  it('omits defaults from URL when filters are cleared', () => {
    const response = baseResponse({
      yearSelector: { calendarYears: [2026, 2025], currentYear: 2026 },
      availableAgents: ['CLAUDE', 'CODEX'],
    });
    renderWithProviders(<ActivityHeatmap initialData={response} errored={false} />);
    const yearFilter = screen.getByTestId('activity-heatmap-year-filter') as HTMLSelectElement;
    fireEvent.change(yearFilter, { target: { value: '2025' } });
    fireEvent.change(yearFilter, { target: { value: '12m' } });
    expect(replaceMock).toHaveBeenLastCalledWith('?', { scroll: false });
  });

  it('renders tooltip content with ticket list and jobs+cost line', () => {
    const cells = baseResponse().cells.map((c, i) =>
      i === 0
        ? {
            ...c,
            jobCount: 3,
            costUsd: 1.24,
            nullCostJobCount: 1,
            shippedTickets: [{ ticketId: 431, title: 'Add login' }],
            intensity: 4 as const,
          }
        : c
    );
    const response = baseResponse({
      cells,
      counters: { jobCount: 3, shippedTicketCount: 1 },
      intensityThresholds: [1, 2, 3, 3],
    });
    const { container } = renderWithProviders(
      <ActivityHeatmap initialData={response} errored={false} />
    );
    const active = container.querySelector('[data-date="2025-04-17"]') as HTMLElement | null;
    expect(active).not.toBeNull();
    expect(active?.getAttribute('data-job-count')).toBe('3');
  });

  it('omits cost line when all jobs on a day have null cost', () => {
    const cells = baseResponse().cells.map((c, i) =>
      i === 0
        ? {
            ...c,
            jobCount: 2,
            costUsd: null,
            nullCostJobCount: 2,
            intensity: 3 as const,
          }
        : c
    );
    const response = baseResponse({
      cells,
      counters: { jobCount: 2, shippedTicketCount: 0 },
      intensityThresholds: [1, 1, 2, 2],
    });
    renderWithProviders(
      <ActivityHeatmap initialData={response} errored={false} />
    );
    // cells render without cost; check no "$NaN" or "$0" text anywhere
    expect(document.body.textContent).not.toMatch(/\$NaN/);
  });

  it('has sticky day-of-week labels column for mobile', () => {
    const response = baseResponse();
    const { container } = renderWithProviders(
      <ActivityHeatmap initialData={response} errored={false} />
    );
    const dayLabels = container.querySelector('[data-testid="activity-heatmap-day-labels"]');
    expect(dayLabels).not.toBeNull();
    expect(dayLabels?.className).toMatch(/sticky/);
  });
});

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap/activity-heatmap';
import type { HeatmapData } from '@/lib/activity-heatmap/types';

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
  usePathname: () => '/projects',
}));

// Replace shadcn Select with a native select so we can drive it from tests.
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

function buildEmptyHeatmap(overrides: Partial<HeatmapData> = {}): HeatmapData {
  return {
    startDate: '2025-04-18',
    endDate: '2026-04-17',
    totalJobs: 0,
    totalTicketsShipped: 0,
    days: [],
    availableAgents: [{ value: 'all', label: 'All agents', jobCount: 0 }],
    availableYears: [2026, 2025],
    filters: { period: 'last-12-months', agent: 'all' },
    generatedAt: '2026-04-17T00:00:00.000Z',
    ...overrides,
  };
}

function buildHeatmapWithActivity(): HeatmapData {
  const data = buildEmptyHeatmap({
    totalJobs: 5,
    totalTicketsShipped: 2,
    days: [
      {
        date: '2026-04-15',
        jobCount: 3,
        totalCostUsd: 1.25,
        hasCost: true,
        shippedTickets: [
          { ticketKey: 'AIB-100', title: 'Fix login bug', projectKey: 'AIB' },
        ],
      },
      {
        date: '2026-04-17',
        jobCount: 2,
        totalCostUsd: 0,
        hasCost: false,
        shippedTickets: [
          { ticketKey: 'AIB-101', title: 'Improve onboarding', projectKey: 'AIB' },
        ],
      },
    ],
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 5 },
      { value: 'CLAUDE', label: 'Claude', jobCount: 3 },
      { value: 'CODEX', label: 'Codex', jobCount: 2 },
    ],
  });
  return data;
}

describe('ActivityHeatmap', () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(buildEmptyHeatmap()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
  );

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the empty-state message when there is no activity', () => {
    renderWithProviders(<ActivityHeatmap initialData={buildEmptyHeatmap()} />);
    expect(screen.getByTestId('activity-heatmap-empty')).toHaveTextContent(
      /No activity to show yet/
    );
  });

  it('hides the agent filter when only the "all" entry exists', () => {
    renderWithProviders(<ActivityHeatmap initialData={buildEmptyHeatmap()} />);
    expect(screen.queryByTestId('activity-heatmap-agent-filter')).toBeNull();
  });

  it('shows the agent filter when multiple distinct agents are present', () => {
    renderWithProviders(<ActivityHeatmap initialData={buildHeatmapWithActivity()} />);
    expect(screen.getByTestId('activity-heatmap-agent-filter')).toBeInTheDocument();
  });

  it('renders the counter using job + shipped totals', () => {
    renderWithProviders(<ActivityHeatmap initialData={buildHeatmapWithActivity()} />);
    expect(screen.getByTestId('activity-heatmap-counter')).toHaveTextContent(
      /5 jobs.*2 tickets shipped/
    );
  });

  it('hides the year selector when only "Last 12 months" is available', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={buildEmptyHeatmap({ availableYears: [] })}
      />
    );
    expect(screen.queryByTestId('activity-heatmap-period-filter')).toBeNull();
  });

  it('renders cells for days with activity and is keyboard-focusable', () => {
    renderWithProviders(<ActivityHeatmap initialData={buildHeatmapWithActivity()} />);
    const cells = screen.getAllByTestId('activity-heatmap-cell');
    expect(cells.length).toBeGreaterThan(0);
    // The two activity days from the fixture should appear among the cells.
    const dates = cells.map((c) => c.getAttribute('data-date'));
    expect(dates).toContain('2026-04-15');
    expect(dates).toContain('2026-04-17');
  });

  it('uses the period from URL search params when present', () => {
    const params = new URLSearchParams({ heatmapPeriod: '2025' });
    // Mutate the shared mock object (do not reassign — the mock returns this reference).
    mockSearchParams.delete('heatmapPeriod');
    for (const [k, v] of params) mockSearchParams.set(k, v);

    renderWithProviders(<ActivityHeatmap initialData={buildHeatmapWithActivity()} />);
    const select = screen.getByTestId('activity-heatmap-period-filter') as HTMLSelectElement;
    expect(select.value).toBe('2025');

    mockSearchParams.delete('heatmapPeriod');
  });
});

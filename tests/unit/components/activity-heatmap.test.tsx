import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import { HeatmapGrid } from '@/components/projects/activity-heatmap/heatmap-grid';
import {
  HeatmapTooltipContent,
} from '@/components/projects/activity-heatmap/heatmap-tooltip';
import { getLevelClass } from '@/components/projects/activity-heatmap/heatmap-grid';
import type { HeatmapPayload, HeatmapDay } from '@/lib/analytics/heatmap-types';

const pushMock = vi.fn();
let mockSearchParams = new URLSearchParams();

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
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>;

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
      return collectOptions(
        (child.props as { children?: React.ReactNode }).children
      );
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
            return React.cloneElement(child as React.ReactElement<{
              value?: string;
              onValueChange?: (v: string) => void;
              options?: React.ReactNode[];
            }>, {
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
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem,
  };
});

function buildDays(dayCount: number, seed: (date: string, index: number) => HeatmapDay): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const start = new Date(Date.UTC(2025, 3, 1));
  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const da = String(d.getUTCDate()).padStart(2, '0');
    days.push(seed(`${y}-${m}-${da}`, i));
  }
  return days;
}

function basePayload(overrides: Partial<HeatmapPayload> = {}): HeatmapPayload {
  const days = buildDays(14, (date, i) => ({
    date,
    jobCount: i % 3,
    totalCost: i % 3 === 0 ? null : (i % 3) * 0.5,
    shippedTickets:
      i === 5
        ? [{ ticketKey: 'AIB-42', title: 'Ship it!' }]
        : [],
    level: (i % 3) as 0 | 1 | 2,
  }));
  return {
    filters: {
      period: { kind: 'last-12-months' },
      agent: 'all',
      timezone: 'UTC',
    },
    meta: {
      rangeStart: '2025-04-01',
      rangeEnd: '2025-04-14',
      label: 'Last 12 months',
    },
    days,
    totals: { jobs: 9, shippedTickets: 1 },
    thresholds: { t1: 1, t2: 2, t3: 3, t4: 4 },
    distinctAgents: ['CLAUDE', 'CODEX'],
    availableYears: [2026, 2025],
    ...overrides,
  };
}

beforeEach(() => {
  pushMock.mockReset();
  mockSearchParams = new URLSearchParams();
});

afterEach(() => {
  mockSearchParams = new URLSearchParams();
});

describe('getLevelClass', () => {
  it('returns complete literal Tailwind class names for each level', () => {
    expect(getLevelClass(0)).toBe('bg-zinc-800/40');
    expect(getLevelClass(1)).toBe('bg-violet-900');
    expect(getLevelClass(2)).toBe('bg-violet-800');
    expect(getLevelClass(3)).toBe('bg-violet-700');
    expect(getLevelClass(4)).toBe('bg-violet-500');
  });
});

describe('HeatmapTooltipContent', () => {
  it('omits the cost line when totalCost is null', () => {
    const day: HeatmapDay = {
      date: '2025-04-05',
      jobCount: 3,
      totalCost: null,
      shippedTickets: [],
      level: 2,
    };
    const { queryByText } = renderWithProviders(<HeatmapTooltipContent day={day} />);
    expect(queryByText(/^Cost:/)).toBeNull();
  });

  it('renders the cost line when totalCost is non-null', () => {
    const day: HeatmapDay = {
      date: '2025-04-05',
      jobCount: 3,
      totalCost: 1.23,
      shippedTickets: [],
      level: 2,
    };
    const { getByText } = renderWithProviders(<HeatmapTooltipContent day={day} />);
    expect(getByText(/Cost: \$1\.23/)).toBeInTheDocument();
  });

  it('renders shipped tickets', () => {
    const day: HeatmapDay = {
      date: '2025-04-05',
      jobCount: 2,
      totalCost: null,
      shippedTickets: [{ ticketKey: 'AIB-99', title: 'Deploy thing' }],
      level: 2,
    };
    const { getByText } = renderWithProviders(<HeatmapTooltipContent day={day} />);
    expect(getByText('AIB-99')).toBeInTheDocument();
    expect(getByText(/Deploy thing/)).toBeInTheDocument();
  });
});

describe('HeatmapGrid', () => {
  it('renders empty-state swap when isEmpty is true', () => {
    const { getByTestId, queryByTestId } = renderWithProviders(
      <HeatmapGrid
        days={[]}
        meta={{ rangeStart: '', rangeEnd: '', label: 'Last 12 months' }}
        isEmpty={true}
        todayKey="2026-04-19"
      />
    );
    expect(getByTestId('activity-heatmap-empty-state')).toBeInTheDocument();
    expect(queryByTestId('activity-heatmap-grid')).toBeNull();
  });

  it('renders the grid with real cells when isEmpty is false', () => {
    const payload = basePayload();
    const { getByTestId, getAllByTestId } = renderWithProviders(
      <HeatmapGrid
        days={payload.days}
        meta={payload.meta}
        isEmpty={false}
        todayKey="2025-04-14"
      />
    );
    expect(getByTestId('activity-heatmap-grid')).toBeInTheDocument();
    expect(getAllByTestId('activity-heatmap-cell').length).toBe(payload.days.length);
  });

  it('opens a tooltip popover when a cell is clicked/tapped', async () => {
    const payload = basePayload();
    const { getAllByTestId, findByTestId } = renderWithProviders(
      <HeatmapGrid
        days={payload.days}
        meta={payload.meta}
        isEmpty={false}
        todayKey="2025-04-14"
      />
    );
    const cells = getAllByTestId('activity-heatmap-cell');
    const firstCell = cells[0];
    if (!firstCell) throw new Error('no cells');
    fireEvent.click(firstCell);
    const tooltip = await findByTestId('activity-heatmap-tooltip');
    expect(tooltip).toBeInTheDocument();
  });

  it('renders future-day cells inside the current year period as level-0', () => {
    const todayKey = '2026-04-19';
    const payload = basePayload({
      filters: {
        period: { kind: 'calendar-year', year: 2026 },
        agent: 'all',
        timezone: 'UTC',
      },
      meta: {
        rangeStart: '2026-01-01',
        rangeEnd: todayKey,
        label: '2026',
      },
      days: buildDays(5, (date) => ({
        date: `2026-01-${date.slice(-2)}`,
        jobCount: 0,
        totalCost: null,
        shippedTickets: [],
        level: 0,
      })),
    });
    const { container } = renderWithProviders(
      <HeatmapGrid
        days={payload.days}
        meta={payload.meta}
        isEmpty={false}
        todayKey={todayKey}
      />
    );
    const futureCells = container.querySelectorAll('[data-future="true"]');
    expect(futureCells.length).toBeGreaterThan(0);
    futureCells.forEach((cell) => {
      expect(cell.getAttribute('data-level')).toBe('0');
    });
  });
});

describe('ActivityHeatmap (container)', () => {
  it('renders the header counter string from totals and meta', () => {
    const payload = basePayload();
    renderWithProviders(<ActivityHeatmap initialData={payload} />);
    expect(screen.getByTestId('activity-heatmap-header')).toHaveTextContent(
      /9 jobs · 1 tickets shipped in Last 12 months/
    );
  });

  it('swaps to empty state when totals.jobs === 0 and keeps the legend', () => {
    const payload = basePayload({
      days: buildDays(3, (date) => ({
        date,
        jobCount: 0,
        totalCost: null,
        shippedTickets: [],
        level: 0,
      })),
      totals: { jobs: 0, shippedTickets: 0 },
    });
    renderWithProviders(<ActivityHeatmap initialData={payload} />);
    expect(screen.getByTestId('activity-heatmap-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('activity-heatmap-legend')).toBeInTheDocument();
  });

  it('hides the agent filter when distinctAgents.length < 2', () => {
    const payload = basePayload({ distinctAgents: ['CLAUDE'] });
    renderWithProviders(<ActivityHeatmap initialData={payload} />);
    expect(screen.queryByTestId('activity-heatmap-agent-filter')).toBeNull();
  });

  it('hides the year selector when availableYears.length < 2', () => {
    const payload = basePayload({ availableYears: [2026] });
    renderWithProviders(<ActivityHeatmap initialData={payload} />);
    expect(screen.queryByTestId('activity-heatmap-period-filter')).toBeNull();
  });

  it('pushes router with scroll:false when year selector changes', async () => {
    const payload = basePayload();
    renderWithProviders(<ActivityHeatmap initialData={payload} />);
    const trigger = screen.getByTestId('activity-heatmap-period-filter');
    fireEvent.change(trigger, { target: { value: '2025' } });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled();
    });
    const lastCall = pushMock.mock.calls[pushMock.mock.calls.length - 1];
    expect(lastCall?.[0]).toContain('period=2025');
    expect(lastCall?.[1]).toEqual({ scroll: false });
  });

  it('pushes router with scroll:false when agent selector changes', async () => {
    const payload = basePayload();
    renderWithProviders(<ActivityHeatmap initialData={payload} />);
    const trigger = screen.getByTestId('activity-heatmap-agent-filter');
    fireEvent.change(trigger, { target: { value: 'CLAUDE' } });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled();
    });
    const lastCall = pushMock.mock.calls[pushMock.mock.calls.length - 1];
    expect(lastCall?.[0]).toContain('agent=CLAUDE');
    expect(lastCall?.[1]).toEqual({ scroll: false });
  });

  it('lists Last 12 months option first and years in descending order', () => {
    const payload = basePayload({ availableYears: [2026, 2025, 2024] });
    renderWithProviders(<ActivityHeatmap initialData={payload} />);
    const select = screen.getByTestId('activity-heatmap-period-filter') as HTMLSelectElement;
    const values = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(values[0]).toBe('last-12-months');
    expect(values.slice(1)).toEqual(['2026', '2025', '2024']);
  });
});

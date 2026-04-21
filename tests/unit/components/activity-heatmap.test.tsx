import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import { ActivityHeatmapCell } from '@/components/projects/activity-heatmap-cell';
import type { DailyCell, HeatmapData } from '@/lib/analytics/heatmap-types';

function mockMatchMedia(touchOnly: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes('hover: none') ? touchOnly : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

beforeEach(() => {
  mockMatchMedia(false);
  mockSearchParams = new URLSearchParams();
  pushMock.mockReset();
});

let mockSearchParams = new URLSearchParams();
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/projects',
}));

vi.mock('@/components/ui/select', () => {
  const SelectItem = ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>;

  function collectOptions(children: React.ReactNode): React.ReactNode[] {
    return React.Children.toArray(children).flatMap((child) => {
      if (!React.isValidElement(child)) return [];
      if (child.type === SelectItem) return [child];
      return collectOptions((child as React.ReactElement<{ children?: React.ReactNode }>).props.children);
    });
  }

  const SelectTrigger = ({
    value,
    options,
    onValueChange,
    'data-testid': dataTestId,
    'aria-label': ariaLabel,
  }: {
    value?: string;
    options?: React.ReactNode[];
    onValueChange?: (value: string) => void;
    'data-testid'?: string;
    'aria-label'?: string;
  }) => (
    <select
      data-testid={dataTestId}
      aria-label={ariaLabel}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
    >
      {options}
    </select>
  );

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
            return React.cloneElement(child as React.ReactElement, { value, onValueChange, options });
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

function buildCell(date: string, jobCount: number): DailyCell {
  return {
    date,
    jobCount,
    shipJobCount: 0,
    shippedTicketCount: 0,
    totalCostUsd: jobCount > 0 ? 1.23 : null,
    bucket: jobCount === 0 ? 0 : 2,
  };
}

function buildHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  const cells: DailyCell[] = [
    buildCell('2025-01-01', 3),
    buildCell('2025-01-02', 0),
    buildCell('2025-01-03', 5),
  ];
  return {
    period: { kind: 'rolling12m', startDate: '2025-01-01', endDate: '2025-01-03' },
    filters: {
      period: { kind: 'rolling12m', endDate: '' },
      agent: 'all',
    },
    cells,
    summary: {
      totalJobs: 8,
      distinctShippedTickets: 2,
      periodLabel: 'in the last year',
    },
    thresholds: { p25: 3, p50: 4, p75: 5, maxJobCount: 5 },
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 8, isDefault: true },
    ],
    availableYears: [],
    generatedAt: '2026-04-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  it('renders summary header with total jobs, shipped tickets, and period label', () => {
    const data = buildHeatmapData();
    renderWithProviders(
      <ActivityHeatmap userId="user-1" initialData={data} />
    );
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toContain('8 jobs');
    expect(heading.textContent).toContain('2 tickets shipped');
    expect(heading.textContent).toContain('in the last year');
  });

  it('renders the 7×N grid from SSR initialData without a loading spinner', () => {
    const data = buildHeatmapData();
    renderWithProviders(
      <ActivityHeatmap userId="user-1" initialData={data} />
    );
    expect(screen.getByRole('grid', { name: /activity heatmap/i })).toBeInTheDocument();
  });

  it('renders empty-state message when every cell has jobCount === 0 while legend stays visible', () => {
    const data = buildHeatmapData({
      cells: [
        buildCell('2025-01-01', 0),
        buildCell('2025-01-02', 0),
        buildCell('2025-01-03', 0),
      ],
      summary: { totalJobs: 0, distinctShippedTickets: 0, periodLabel: 'in the last year' },
      thresholds: { p25: 0, p50: 0, p75: 0, maxJobCount: 0 },
    });
    renderWithProviders(
      <ActivityHeatmap userId="user-1" initialData={data} />
    );
    expect(
      screen.getByText(/No activity to show yet — your AI work will appear here/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('renders a non-blocking error card when initialError is set and data is undefined', () => {
    renderWithProviders(
      <ActivityHeatmap
        userId="user-1"
        initialData={null}
        initialError={{ message: "Couldn't load activity — please refresh" }}
      />
    );
    expect(
      screen.getByText(/Couldn't load activity — please refresh/i)
    ).toBeInTheDocument();
  });

  it('renders legend with exactly 5 swatches and Less/More labels', () => {
    const data = buildHeatmapData();
    const { container } = renderWithProviders(
      <ActivityHeatmap userId="user-1" initialData={data} />
    );
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
    const swatches = container.querySelectorAll(
      '[class*="aurora-heatmap-bucket-"]'
    );
    const legendSwatches = Array.from(swatches).filter(
      (el) => el.tagName === 'SPAN' && el.getAttribute('aria-hidden') === 'true' && !el.hasAttribute('data-bucket')
    );
    expect(legendSwatches).toHaveLength(5);
  });
});

describe('ActivityHeatmapCell tooltip (US2)', () => {
  it('shows date, shipped, and jobs · cost in tooltip on hover (desktop)', async () => {
    mockMatchMedia(false);
    const cell: DailyCell = {
      date: '2025-04-15',
      jobCount: 4,
      shipJobCount: 1,
      shippedTicketCount: 1,
      totalCostUsd: 1.23,
      bucket: 3,
    };
    renderWithProviders(<ActivityHeatmapCell cell={cell} column={1} row={1} />);
    const user = userEvent.setup();
    const button = screen.getByRole('gridcell', { name: /2025-04-15: 4 jobs/i });
    await user.hover(button);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toMatch(/April 15, 2025|2025/);
    expect(tooltip.textContent).toContain('1 ticket shipped');
    expect(tooltip.textContent).toContain('4 jobs');
    expect(tooltip.textContent).toContain('$1.23');
  });

  it('omits cost entirely when totalCostUsd is null (no $NaN / $0)', async () => {
    mockMatchMedia(false);
    const cell: DailyCell = {
      date: '2025-04-15',
      jobCount: 4,
      shipJobCount: 0,
      shippedTicketCount: 0,
      totalCostUsd: null,
      bucket: 2,
    };
    renderWithProviders(<ActivityHeatmapCell cell={cell} column={1} row={1} />);
    const user = userEvent.setup();
    const button = screen.getByRole('gridcell', { name: /2025-04-15: 4 jobs/i });
    await user.hover(button);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).not.toContain('$');
    expect(tooltip.textContent).not.toContain('NaN');
    expect(tooltip.textContent).toContain('4 jobs');
  });

  it('opens the popover root on touch-only viewports', async () => {
    mockMatchMedia(true);
    const cell: DailyCell = {
      date: '2025-04-15',
      jobCount: 2,
      shipJobCount: 0,
      shippedTicketCount: 0,
      totalCostUsd: 0.5,
      bucket: 1,
    };
    renderWithProviders(<ActivityHeatmapCell cell={cell} column={1} row={1} />);
    const user = userEvent.setup();
    const button = screen.getByRole('gridcell', { name: /2025-04-15: 2 jobs/i });
    await user.click(button);
    await waitFor(() => {
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });
  });
});

describe('ActivityHeatmap year selector (US3)', () => {
  it('offers "Last 12 months" + each year in availableYears descending', () => {
    const data = buildHeatmapData({ availableYears: [2026, 2025, 2024] });
    renderWithProviders(<ActivityHeatmap userId="user-1" initialData={data} />);
    const select = screen.getByTestId('heatmap-period-filter') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((opt) => opt.value);
    expect(optionValues).toEqual(['last12months', '2026', '2025', '2024']);
  });

  it('is not rendered when availableYears is empty', () => {
    const data = buildHeatmapData({ availableYears: [] });
    renderWithProviders(<ActivityHeatmap userId="user-1" initialData={data} />);
    expect(screen.queryByTestId('heatmap-period-filter')).not.toBeInTheDocument();
  });

  it('sets heatmapPeriod=YYYY when a year is selected', async () => {
    const data = buildHeatmapData({ availableYears: [2026, 2025, 2024] });
    renderWithProviders(<ActivityHeatmap userId="user-1" initialData={data} />);
    const user = userEvent.setup();
    const select = screen.getByTestId('heatmap-period-filter') as HTMLSelectElement;
    await user.selectOptions(select, '2025');
    expect(pushMock).toHaveBeenCalledTimes(1);
    const [url] = pushMock.mock.calls[0] as [string, unknown];
    expect(url).toContain('heatmapPeriod=2025');
  });

  it('omits heatmapPeriod from URL when "Last 12 months" is selected', async () => {
    mockSearchParams = new URLSearchParams('heatmapPeriod=2025');
    const yearData: HeatmapData = buildHeatmapData({
      availableYears: [2026, 2025, 2024],
      filters: {
        period: { kind: 'year', year: 2025 },
        agent: 'all',
      },
      period: { kind: 'year', startDate: '2025-01-01', endDate: '2025-12-31', year: 2025 },
    });
    renderWithProviders(<ActivityHeatmap userId="user-1" initialData={yearData} />);
    const user = userEvent.setup();
    const select = screen.getByTestId('heatmap-period-filter') as HTMLSelectElement;
    await user.selectOptions(select, 'last12months');
    expect(pushMock).toHaveBeenCalledTimes(1);
    const [url] = pushMock.mock.calls[0] as [string, unknown];
    expect(url).not.toContain('heatmapPeriod');
  });
});

describe('ActivityHeatmap mobile layout (US5)', () => {
  it('wraps the grid in an overflow-x-auto scroll container', () => {
    const data = buildHeatmapData();
    const { container } = renderWithProviders(
      <ActivityHeatmap userId="user-1" initialData={data} />
    );
    const scroller = container.querySelector('.overflow-x-auto');
    expect(scroller).not.toBeNull();
  });

  it('day-of-week label column has sticky + left-0 classes', () => {
    const data = buildHeatmapData();
    const { container } = renderWithProviders(
      <ActivityHeatmap userId="user-1" initialData={data} />
    );
    const sticky = container.querySelector('.sticky.left-0');
    expect(sticky).not.toBeNull();
  });

  it('cell classes come from BUCKET_CLASSES as literal strings (no dynamic concatenation)', () => {
    const data = buildHeatmapData();
    const { container } = renderWithProviders(
      <ActivityHeatmap userId="user-1" initialData={data} />
    );
    const cells = container.querySelectorAll('[data-bucket]');
    const literalPrefix = /aurora-heatmap-bucket-[0-4]/;
    for (const cell of Array.from(cells)) {
      const cls = cell.className;
      expect(cls).toMatch(literalPrefix);
    }
  });
});

describe('ActivityHeatmap agent filter (US4)', () => {
  it('is not rendered when fewer than 2 named agents are available', () => {
    const data = buildHeatmapData({
      availableAgents: [
        { value: 'all', label: 'All agents', jobCount: 8, isDefault: true },
        { value: 'CLAUDE', label: 'Claude', jobCount: 8, isDefault: false },
      ],
    });
    renderWithProviders(<ActivityHeatmap userId="user-1" initialData={data} />);
    expect(screen.queryByTestId('heatmap-agent-filter')).not.toBeInTheDocument();
  });

  it('renders when 2+ named agents are available; selecting an agent sets heatmapAgent=<AGENT>', async () => {
    const data = buildHeatmapData({
      availableAgents: [
        { value: 'all', label: 'All agents', jobCount: 16, isDefault: true },
        { value: 'CLAUDE', label: 'Claude', jobCount: 8, isDefault: false },
        { value: 'CODEX', label: 'Codex', jobCount: 8, isDefault: false },
      ],
    });
    renderWithProviders(<ActivityHeatmap userId="user-1" initialData={data} />);
    const user = userEvent.setup();
    const select = screen.getByTestId('heatmap-agent-filter') as HTMLSelectElement;
    await user.selectOptions(select, 'CLAUDE');
    expect(pushMock).toHaveBeenCalledTimes(1);
    const [url] = pushMock.mock.calls[0] as [string, unknown];
    expect(url).toContain('heatmapAgent=CLAUDE');
  });

  it('omits heatmapAgent from URL when "All agents" is selected', async () => {
    mockSearchParams = new URLSearchParams('heatmapAgent=CLAUDE');
    const data = buildHeatmapData({
      availableAgents: [
        { value: 'all', label: 'All agents', jobCount: 16, isDefault: true },
        { value: 'CLAUDE', label: 'Claude', jobCount: 8, isDefault: false },
        { value: 'CODEX', label: 'Codex', jobCount: 8, isDefault: false },
      ],
      filters: {
        period: { kind: 'rolling12m', endDate: '' },
        agent: 'CLAUDE',
      },
    });
    renderWithProviders(<ActivityHeatmap userId="user-1" initialData={data} />);
    const user = userEvent.setup();
    const select = screen.getByTestId('heatmap-agent-filter') as HTMLSelectElement;
    await user.selectOptions(select, 'all');
    expect(pushMock).toHaveBeenCalledTimes(1);
    const [url] = pushMock.mock.calls[0] as [string, unknown];
    expect(url).not.toContain('heatmapAgent');
  });
});

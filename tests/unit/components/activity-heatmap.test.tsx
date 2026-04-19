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
});

const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

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
      (el) => el.getAttribute('aria-hidden') === 'true'
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
    const button = screen.getByRole('button', { name: /2025-04-15: 4 jobs/i });
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
    const button = screen.getByRole('button', { name: /2025-04-15: 4 jobs/i });
    await user.hover(button);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).not.toContain('$');
    expect(tooltip.textContent).not.toContain('NaN');
    expect(tooltip.textContent).toContain('4 jobs');
  });

  it('uses a Popover on touch-only viewports', async () => {
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
    const button = screen.getByRole('button', { name: /2025-04-15: 2 jobs/i });
    await user.click(button);
    await waitFor(() => {
      expect(button.getAttribute('aria-expanded')).toBe('true');
    });
  });
});

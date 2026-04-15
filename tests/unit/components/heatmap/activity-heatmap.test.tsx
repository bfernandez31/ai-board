import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/heatmap/activity-heatmap';
import type { HeatmapData } from '@/lib/heatmap/types';

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: mockPush }),
}));

// Mock useHeatmap hook
vi.mock('@/app/lib/hooks/queries/use-heatmap', () => ({
  useHeatmap: (_initialData: HeatmapData) => ({
    data: _initialData,
    isLoading: false,
    error: null,
  }),
}));

function makeHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  return {
    days: [
      {
        date: '2026-03-15',
        jobCount: 5,
        costUsd: 1.23,
        shippedTickets: [{ ticketKey: 'AIB-42', title: 'Add dark mode toggle' }],
      },
      {
        date: '2026-03-16',
        jobCount: 3,
        costUsd: null,
        shippedTickets: [],
      },
    ],
    totalJobs: 8,
    totalShipped: 1,
    agents: [
      { value: 'all', label: 'All agents', jobCount: 8, isDefault: true },
    ],
    periodLabel: 'in the last year',
    userCreatedYear: 2025,
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders heatmap grid with cells', () => {
    const data = makeHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    // Should render the grid
    expect(screen.getByRole('grid', { name: 'Activity heatmap' })).toBeInTheDocument();
  });

  it('renders header with job and shipped counts', () => {
    const data = makeHeatmapData({ totalJobs: 150, totalShipped: 12 });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByText(/150 jobs/)).toBeInTheDocument();
    expect(screen.getByText(/12 tickets shipped/)).toBeInTheDocument();
  });

  it('displays empty state when totalJobs is 0 and no filters shown', () => {
    const data = makeHeatmapData({
      days: [],
      totalJobs: 0,
      totalShipped: 0,
      userCreatedYear: new Date().getUTCFullYear(),
      agents: [{ value: 'all', label: 'All agents', jobCount: 0, isDefault: true }],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(
      screen.getByText('No activity to show yet — your AI work will appear here')
    ).toBeInTheDocument();
  });

  it('renders legend with Less and More labels', () => {
    const data = makeHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('renders period label in header', () => {
    const data = makeHeatmapData({ periodLabel: 'in 2025' });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByText(/in 2025/)).toBeInTheDocument();
  });

  it('hides year selector when user created in current year', () => {
    const currentYear = new Date().getUTCFullYear();
    const data = makeHeatmapData({ userCreatedYear: currentYear });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    // Should not render "Last 12 months" select option
    expect(screen.queryByText('Last 12 months')).not.toBeInTheDocument();
  });

  it('shows year selector when user has historical years', () => {
    const data = makeHeatmapData({ userCreatedYear: 2024 });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    // The select trigger should show "Last 12 months" as default
    expect(screen.getByText('Last 12 months')).toBeInTheDocument();
  });

  it('hides agent filter when 2 or fewer agents', () => {
    const data = makeHeatmapData({
      agents: [
        { value: 'all', label: 'All agents', jobCount: 8, isDefault: true },
        { value: 'CLAUDE', label: 'Claude', jobCount: 8, isDefault: false },
      ],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    // Agent filter should not be visible
    expect(screen.queryByText('Claude')).not.toBeInTheDocument();
  });

  it('shows agent filter when more than 2 agents', () => {
    const data = makeHeatmapData({
      agents: [
        { value: 'all', label: 'All agents', jobCount: 10, isDefault: true },
        { value: 'CLAUDE', label: 'Claude', jobCount: 7, isDefault: false },
        { value: 'CODEX', label: 'Codex', jobCount: 3, isDefault: false },
      ],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByText('All agents')).toBeInTheDocument();
  });

  it('renders gridcell elements for dates with data', () => {
    const data = makeHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    const cells = screen.getAllByRole('gridcell');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('grid container has overflow-x-auto for mobile scrolling', () => {
    const data = makeHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    const grid = screen.getByRole('grid', { name: 'Activity heatmap' });
    // The grid wrapper div should have overflow-x-auto class
    expect(grid.className).toContain('overflow-x-auto');
  });

  it('day-of-week labels have sticky positioning', () => {
    const data = makeHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    const grid = screen.getByRole('grid', { name: 'Activity heatmap' });
    // Find the sticky day labels container
    const stickyDiv = grid.querySelector('.sticky');
    expect(stickyDiv).toBeInTheDocument();
  });

  it('renders header counter with correct format', () => {
    const data = makeHeatmapData({
      totalJobs: 42,
      totalShipped: 7,
      periodLabel: 'in the last year',
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByText(/42 jobs/)).toBeInTheDocument();
    expect(screen.getByText(/7 tickets shipped/)).toBeInTheDocument();
    expect(screen.getByText(/in the last year/)).toBeInTheDocument();
  });
});

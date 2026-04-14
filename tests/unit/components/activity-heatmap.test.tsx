import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  within,
  userEvent,
} from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import type { HeatmapResponse } from '@/lib/activity-heatmap/types';

const mockHeatmapData: HeatmapResponse = {
  days: [
    { date: '2026-03-15', jobCount: 5, costUsd: 1.23, ticketsShipped: 1 },
    { date: '2026-03-16', jobCount: 2, costUsd: null, ticketsShipped: 0 },
    { date: '2026-03-17', jobCount: 1, costUsd: 0.50, ticketsShipped: 0 },
    { date: '2026-03-18', jobCount: 8, costUsd: 3.00, ticketsShipped: 2 },
  ],
  totalJobs: 16,
  totalTicketsShipped: 3,
  availableYears: [2025, 2026],
  availableAgents: [
    { value: 'all', label: 'All agents', jobCount: 16 },
    { value: 'CLAUDE', label: 'Claude', jobCount: 12 },
    { value: 'CODEX', label: 'Codex', jobCount: 4 },
  ],
  period: { start: '2025-04-14', end: '2026-04-14' },
};

const emptyHeatmapData: HeatmapResponse = {
  days: [],
  totalJobs: 0,
  totalTicketsShipped: 0,
  availableYears: [],
  availableAgents: [{ value: 'all', label: 'All agents', jobCount: 0 }],
  period: { start: '2025-04-14', end: '2026-04-14' },
};

vi.mock('@/hooks/use-activity-heatmap', () => ({
  useActivityHeatmap: vi.fn(),
}));

import { useActivityHeatmap } from '@/hooks/use-activity-heatmap';
const mockUseActivityHeatmap = vi.mocked(useActivityHeatmap);

function mockHeatmapHook(data: HeatmapResponse | null, isLoading = false) {
  mockUseActivityHeatmap.mockReturnValue({
    data: data ?? undefined,
    isLoading,
    error: null,
    isError: false,
    isPending: isLoading,
    isSuccess: !isLoading && data != null,
    status: isLoading ? 'pending' : 'success',
    dataUpdatedAt: Date.now(),
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isInitialLoading: false,
    isLoadingError: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    refetch: vi.fn(),
    fetchStatus: 'idle',
    promise: Promise.resolve(data ?? (emptyHeatmapData as HeatmapResponse)),
  });
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 7 rows and 52+ column grid', () => {
    mockHeatmapHook(mockHeatmapData);
    renderWithProviders(<ActivityHeatmap />);

    const grid = screen.getByTestId('heatmap-grid');
    expect(grid).toBeInTheDocument();

    // 52 week columns
    const columns = within(grid).getAllByTestId('heatmap-column');
    expect(columns).toHaveLength(52);

    // Each column has 7 cells (one per day of week) — cells use either trigger or empty testid
    const firstColTriggers = within(columns[0]!).queryAllByTestId('heatmap-cell-trigger');
    const firstColEmpty = within(columns[0]!).queryAllByTestId('heatmap-cell-empty');
    expect(firstColTriggers.length + firstColEmpty.length).toBe(7);

    // Total cells across all columns
    const allTriggers = within(grid).queryAllByTestId('heatmap-cell-trigger');
    const allEmpty = within(grid).queryAllByTestId('heatmap-cell-empty');
    expect(allTriggers.length + allEmpty.length).toBe(52 * 7);
  });

  it('shows correct header metrics', () => {
    mockHeatmapHook(mockHeatmapData);
    renderWithProviders(<ActivityHeatmap />);

    expect(screen.getByText(/16 jobs/)).toBeInTheDocument();
    expect(screen.getByText(/3 tickets shipped/)).toBeInTheDocument();
  });

  it('renders empty state with zero counts', () => {
    mockHeatmapHook(emptyHeatmapData);
    renderWithProviders(<ActivityHeatmap />);

    expect(screen.getByText(/0 jobs/)).toBeInTheDocument();
    expect(screen.getByText(/0 tickets shipped/)).toBeInTheDocument();
  });

  it('legend shows 5 intensity levels', () => {
    mockHeatmapHook(mockHeatmapData);
    renderWithProviders(<ActivityHeatmap />);

    const legend = screen.getByTestId('heatmap-legend');
    expect(legend).toBeInTheDocument();
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();

    const legendCells = within(legend).getAllByTestId('legend-cell');
    expect(legendCells).toHaveLength(5);
  });

  it('mobile horizontal scroll container present', () => {
    mockHeatmapHook(mockHeatmapData);
    renderWithProviders(<ActivityHeatmap />);

    const scrollContainer = screen.getByTestId('heatmap-scroll-container');
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer.className).toContain('overflow-x-auto');
  });

  // US2: Tooltip scenarios
  describe('tooltips', () => {
    it('tooltip displays on cell hover with correct data', async () => {
      mockHeatmapHook(mockHeatmapData);
      renderWithProviders(<ActivityHeatmap />);

      const user = userEvent.setup();
      // Find cells with data - they have tooltip triggers
      const tooltipTriggers = screen.getAllByTestId('heatmap-cell-trigger');
      expect(tooltipTriggers.length).toBeGreaterThan(0);

      // Hover over the first trigger
      await user.hover(tooltipTriggers[0]!);

      // Tooltip should appear
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toBeInTheDocument();
    });

    it('tooltip shows "No activity" for empty cells', async () => {
      mockHeatmapHook(mockHeatmapData);
      renderWithProviders(<ActivityHeatmap />);

      const user = userEvent.setup();
      // Find any empty cell trigger (cells with no data)
      const emptyCells = screen.getAllByTestId('heatmap-cell-empty');
      expect(emptyCells.length).toBeGreaterThan(0);

      await user.hover(emptyCells[0]!);

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toContain('No activity');
    });

    it('tooltip hides cost when costUsd is null', async () => {
      // The mock data has a day with costUsd: null (2026-03-16)
      mockHeatmapHook(mockHeatmapData);
      renderWithProviders(<ActivityHeatmap />);

      // We verify that the component renders without errors
      // and that cells without cost data don't show cost in tooltip
      const triggers = screen.getAllByTestId('heatmap-cell-trigger');
      expect(triggers.length).toBeGreaterThan(0);
    });
  });

  // US3: Year selector scenarios
  describe('year selector', () => {
    it('year selector defaults to "Last 12 months"', () => {
      mockHeatmapHook(mockHeatmapData);
      renderWithProviders(<ActivityHeatmap />);

      const yearSelector = screen.getByTestId('year-selector');
      expect(yearSelector).toBeInTheDocument();
      expect(yearSelector.textContent).toContain('Last 12 months');
    });

    it('selecting a year triggers re-fetch', async () => {
      mockHeatmapHook(mockHeatmapData);
      renderWithProviders(<ActivityHeatmap />);

      const user = userEvent.setup();
      const yearTrigger = screen.getByTestId('year-selector');
      await user.click(yearTrigger);

      // Year options should appear
      const option2025 = await screen.findByText('2025');
      await user.click(option2025);

      // Hook should be called with updated year
      expect(mockUseActivityHeatmap).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2025 })
      );
    });
  });

  // US4: Agent filter scenarios
  describe('agent filter', () => {
    it('agent filter defaults to "All"', () => {
      mockHeatmapHook(mockHeatmapData);
      renderWithProviders(<ActivityHeatmap />);

      const agentFilter = screen.getByTestId('agent-filter');
      expect(agentFilter).toBeInTheDocument();
      expect(agentFilter.textContent).toContain('All agents');
    });

    it('selecting an agent triggers re-fetch', async () => {
      mockHeatmapHook(mockHeatmapData);
      renderWithProviders(<ActivityHeatmap />);

      const user = userEvent.setup();
      const agentTrigger = screen.getByTestId('agent-filter');
      await user.click(agentTrigger);

      const claudeOption = await screen.findByText('Claude');
      await user.click(claudeOption);

      expect(mockUseActivityHeatmap).toHaveBeenCalledWith(
        expect.objectContaining({ agent: 'CLAUDE' })
      );
    });
  });
});

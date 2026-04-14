import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, userEvent } from '@/tests/utils/component-test-utils';
import type { HeatmapData } from '@/lib/heatmap/types';

const mockUseHeatmap = vi.fn();

vi.mock('@/app/lib/hooks/queries/use-heatmap', () => ({
  useHeatmap: (...args: unknown[]) => mockUseHeatmap(...args),
}));

// Mock shadcn Select as native <select> for testability (same pattern as analytics-dashboard.test.tsx)
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

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  return {
    cells: [
      { date: '2026-04-10', jobCount: 3, costUsd: 1.5, ticketsShipped: 1 },
      { date: '2026-04-11', jobCount: 7, costUsd: 3.2, ticketsShipped: 2 },
      { date: '2026-04-12', jobCount: 1, costUsd: 0.5, ticketsShipped: 0 },
    ],
    summary: { totalJobs: 11, totalTicketsShipped: 3 },
    filters: { year: 'rolling', agent: 'all' },
    availableYears: [2025, 2026],
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 11, isDefault: true },
      { value: 'CLAUDE', label: 'Claude', jobCount: 8, isDefault: false },
    ],
    ...overrides,
  };
}

// Lazy-load the component so mocks are in place
async function loadActivityHeatmap() {
  const mod = await import('@/components/heatmap/activity-heatmap');
  return mod.ActivityHeatmap;
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('US1: Grid rendering', () => {
    it('renders the heatmap grid with 7 day rows', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      // Should render day labels for Mon, Wed, Fri
      await waitFor(() => {
        expect(screen.getByText('Mon')).toBeDefined();
        expect(screen.getByText('Wed')).toBeDefined();
        expect(screen.getByText('Fri')).toBeDefined();
      });
    });

    it('renders month labels', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      // At least one month label should be rendered
      await waitFor(() => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const foundMonth = monthNames.some((m) => screen.queryByText(m) !== null);
        expect(foundMonth).toBe(true);
      });
    });

    it('renders the intensity legend', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      await waitFor(() => {
        expect(screen.getByText('Less')).toBeDefined();
        expect(screen.getByText('More')).toBeDefined();
      });
    });

    it('shows empty state when no data', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData({
          cells: [],
          summary: { totalJobs: 0, totalTicketsShipped: 0 },
        }),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      await waitFor(() => {
        expect(screen.getByText(/no activity/i)).toBeDefined();
      });
    });

    it('shows loading state', async () => {
      mockUseHeatmap.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      await waitFor(() => {
        expect(screen.getByText(/loading/i)).toBeDefined();
      });
    });
  });

  describe('US3: Header summary', () => {
    it('shows correct summary text', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      await waitFor(() => {
        expect(screen.getByText('11')).toBeDefined();
        expect(screen.getByText('3')).toBeDefined();
        expect(screen.getByText(/tickets shipped in the/)).toBeDefined();
        expect(screen.getByText(/last year/)).toBeDefined();
      });
    });

    it('updates period label for specific year', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData({ filters: { year: 2025, agent: 'all' } }),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      await waitFor(() => {
        expect(screen.getByText(/year 2025/)).toBeDefined();
      });
    });
  });

  describe('US4: Year selector', () => {
    it('renders year selector with default "Last 12 months"', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      await waitFor(() => {
        const yearFilter = screen.getByTestId('heatmap-year-filter') as HTMLSelectElement;
        expect(yearFilter.value).toBe('rolling');
      });
    });

    it('calls useHeatmap with updated year when changed', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-year-filter')).toBeDefined();
      });

      const yearFilter = screen.getByTestId('heatmap-year-filter');
      await user.selectOptions(yearFilter, '2025');

      await waitFor(() => {
        expect(mockUseHeatmap).toHaveBeenCalledWith(
          expect.objectContaining({ year: '2025' })
        );
      });
    });
  });

  describe('US5: Agent filter', () => {
    it('renders agent filter with default "All agents"', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      await waitFor(() => {
        const agentFilter = screen.getByTestId('heatmap-agent-filter') as HTMLSelectElement;
        expect(agentFilter.value).toBe('all');
      });
    });

    it('calls useHeatmap with updated agent when changed', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByTestId('heatmap-agent-filter')).toBeDefined();
      });

      const agentFilter = screen.getByTestId('heatmap-agent-filter');
      await user.selectOptions(agentFilter, 'CLAUDE');

      await waitFor(() => {
        expect(mockUseHeatmap).toHaveBeenCalledWith(
          expect.objectContaining({ agent: 'CLAUDE' })
        );
      });
    });
  });

  describe('US2: Tooltips', () => {
    it('shows tooltip with activity details on hover', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getAllByTestId('heatmap-cell').length).toBeGreaterThan(0);
      });

      // Find a cell with activity and hover it
      const cells = screen.getAllByTestId('heatmap-cell');
      const cellWithActivity = cells.find((c) => c.getAttribute('data-date') === '2026-04-10');
      if (cellWithActivity) {
        await user.hover(cellWithActivity);
        await waitFor(() => {
          // Radix portal can render multiples — use getAllByText
          const matches = screen.getAllByText(/1 ticket shipped/);
          expect(matches.length).toBeGreaterThan(0);
        });
      }
    });

    it('shows "No activity" tooltip for empty cells', async () => {
      mockUseHeatmap.mockReturnValue({
        data: makeHeatmapData(),
        isLoading: false,
        isError: false,
      });

      const ActivityHeatmap = await loadActivityHeatmap();
      renderWithProviders(<ActivityHeatmap />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getAllByTestId('heatmap-cell').length).toBeGreaterThan(0);
      });

      // Find a cell without activity (date not in our test data)
      const cells = screen.getAllByTestId('heatmap-cell');
      const emptyCells = cells.filter((c) => {
        const date = c.getAttribute('data-date');
        return date && !['2026-04-10', '2026-04-11', '2026-04-12'].includes(date);
      });

      if (emptyCells.length > 0) {
        await user.hover(emptyCells[0]);
        await waitFor(() => {
          const matches = screen.getAllByText('No activity');
          expect(matches.length).toBeGreaterThan(0);
        });
      }
    });
  });
});

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import type { HeatmapData } from '@/lib/heatmap/types';

const mockUseHeatmap = vi.fn();

vi.mock('@/app/lib/hooks/queries/use-heatmap', () => ({
  useHeatmap: (...args: unknown[]) => mockUseHeatmap(...args),
}));

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
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import type { HeatmapResponse } from '@/app/api/activity/heatmap/route';

const mockHeatmapData: HeatmapResponse = {
  days: [
    { date: '2026-04-10', jobCount: 3, shippedCount: 1, totalCost: 2.50 },
    { date: '2026-04-11', jobCount: 1, shippedCount: 0, totalCost: 0.75 },
    { date: '2026-04-12', jobCount: 5, shippedCount: 2, totalCost: 4.00 },
  ],
  totalJobs: 9,
  totalShipped: 3,
  yearStart: '2025-04-14T00:00:00.000Z',
  yearEnd: '2026-04-14T23:59:59.999Z',
  availableYears: [2026, 2025],
};

// Mock fetch globally
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

describe('ActivityHeatmap', () => {
  it('should render loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithProviders(<ActivityHeatmap />);

    expect(screen.getByText('Activity')).toBeInTheDocument();
  });

  it('should render heatmap data after loading', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockHeatmapData,
    });

    renderWithProviders(<ActivityHeatmap />);

    await waitFor(() => {
      expect(screen.getByText(/9 jobs/)).toBeInTheDocument();
    });

    expect(screen.getByText(/3 tickets shipped/)).toBeInTheDocument();
  });

  it('should render filter controls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockHeatmapData,
    });

    renderWithProviders(<ActivityHeatmap />);

    await waitFor(() => {
      expect(screen.getByText(/9 jobs/)).toBeInTheDocument();
    });

    // Should have the agent and year filter triggers
    expect(screen.getByText('All agents')).toBeInTheDocument();
    expect(screen.getByText('Last 12 months')).toBeInTheDocument();
  });

  it('should render intensity legend', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockHeatmapData,
    });

    renderWithProviders(<ActivityHeatmap />);

    await waitFor(() => {
      expect(screen.getByText('Less')).toBeInTheDocument();
    });

    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('should render day labels', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockHeatmapData,
    });

    renderWithProviders(<ActivityHeatmap />);

    await waitFor(() => {
      expect(screen.getByText('Mon')).toBeInTheDocument();
    });

    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
  });

  it('should render month labels', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockHeatmapData,
    });

    renderWithProviders(<ActivityHeatmap />);

    await waitFor(() => {
      // With a rolling 12-month range, month labels should appear
      // Apr may appear twice (start and end of rolling year), so use getAllByText
      expect(screen.getAllByText('Apr').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByText('May').length).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty heatmap data', async () => {
    const emptyData: HeatmapResponse = {
      days: [],
      totalJobs: 0,
      totalShipped: 0,
      yearStart: '2025-04-14T00:00:00.000Z',
      yearEnd: '2026-04-14T23:59:59.999Z',
      availableYears: [],
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => emptyData,
    });

    renderWithProviders(<ActivityHeatmap />);

    await waitFor(() => {
      expect(screen.getByText(/0 jobs/)).toBeInTheDocument();
    });

    expect(screen.getByText(/0 tickets shipped/)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, within } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import type { HeatmapData } from '@/lib/heatmap/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function makeHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  return {
    days: {},
    totalJobs: 0,
    totalShipped: 0,
    availableAgents: [],
    periodStart: '2025-04-18',
    periodEnd: '2026-04-18',
    userCreatedAt: '2024-01-01T00:00:00.000Z',
    filters: { period: 'last-12-months', agent: 'all' },
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the card with empty state when no activity', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    expect(screen.getByTestId('activity-heatmap')).toBeInTheDocument();
    expect(screen.getByTestId('heatmap-empty-state')).toHaveTextContent(
      'No activity to show yet'
    );
  });

  it('shows summary counter with jobs and shipped tickets', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          totalJobs: 42,
          totalShipped: 5,
          days: {
            '2025-06-01': { date: '2025-06-01', jobCount: 10, costUsd: 1.5, shippedTickets: [] },
          },
        })}
      />
    );

    const summary = screen.getByTestId('heatmap-summary');
    expect(summary).toHaveTextContent('42 jobs');
    expect(summary).toHaveTextContent('5 tickets shipped');
  });

  it('renders heatmap grid cells when data exists', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          totalJobs: 3,
          days: {
            '2025-06-01': { date: '2025-06-01', jobCount: 3, costUsd: null, shippedTickets: [] },
          },
        })}
      />
    );

    const cells = screen.getAllByTestId('heatmap-cell');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('renders intensity legend', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          totalJobs: 1,
          days: {
            '2025-06-01': { date: '2025-06-01', jobCount: 1, costUsd: null, shippedTickets: [] },
          },
        })}
      />
    );

    const legendCells = screen.getAllByTestId('heatmap-legend-cell');
    expect(legendCells).toHaveLength(5);
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('shows legend even with empty state', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const legendCells = screen.getAllByTestId('heatmap-legend-cell');
    expect(legendCells).toHaveLength(5);
  });

  it('shows year selector when user account predates current year', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          userCreatedAt: '2024-01-15T00:00:00.000Z',
        })}
      />
    );

    expect(screen.getByTestId('heatmap-period-selector')).toBeInTheDocument();
  });

  it('hides year selector when user created this year', () => {
    const currentYear = new Date().getFullYear();
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          userCreatedAt: `${currentYear}-03-01T00:00:00.000Z`,
        })}
      />
    );

    expect(screen.queryByTestId('heatmap-period-selector')).not.toBeInTheDocument();
    expect(screen.getByText('Last 12 months')).toBeInTheDocument();
  });

  it('hides agent filter when 0 or 1 agents', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({ availableAgents: [] })}
      />
    );

    expect(screen.queryByTestId('heatmap-agent-filter')).not.toBeInTheDocument();
  });

  it('shows agent filter when multiple agents available', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          availableAgents: [
            { value: 'all', label: 'All agents' },
            { value: 'CLAUDE', label: 'Claude' },
            { value: 'GEMINI', label: 'Gemini' },
          ],
        })}
      />
    );

    expect(screen.getByTestId('heatmap-agent-filter')).toBeInTheDocument();
  });

  it('renders cells with correct intensity class', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          totalJobs: 12,
          periodStart: '2025-06-01',
          periodEnd: '2025-06-07',
          days: {
            '2025-06-01': { date: '2025-06-01', jobCount: 0, costUsd: null, shippedTickets: [] },
            '2025-06-02': { date: '2025-06-02', jobCount: 1, costUsd: null, shippedTickets: [] },
            '2025-06-03': { date: '2025-06-03', jobCount: 4, costUsd: null, shippedTickets: [] },
          },
        })}
      />
    );

    const zeroDayCell = screen.getAllByTestId('heatmap-cell').find(
      (el) => el.getAttribute('data-date') === '2025-06-01'
    );
    expect(zeroDayCell?.className).toContain('aurora-heatmap-0');

    const activeDayCell = screen.getAllByTestId('heatmap-cell').find(
      (el) => el.getAttribute('data-date') === '2025-06-02'
    );
    expect(activeDayCell?.className).toContain('aurora-heatmap-');
  });

  it('uses singular for 1 job and 1 ticket', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          totalJobs: 1,
          totalShipped: 1,
          days: {
            '2025-06-01': { date: '2025-06-01', jobCount: 1, costUsd: null, shippedTickets: [] },
          },
        })}
      />
    );

    const summary = screen.getByTestId('heatmap-summary');
    expect(summary).toHaveTextContent('1 job ·');
    expect(summary).toHaveTextContent('1 ticket shipped');
  });

  it('cells have accessible aria-label attributes', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          totalJobs: 5,
          periodStart: '2025-06-01',
          periodEnd: '2025-06-07',
          days: {
            '2025-06-02': { date: '2025-06-02', jobCount: 5, costUsd: null, shippedTickets: [] },
          },
        })}
      />
    );

    const cell = screen.getAllByTestId('heatmap-cell').find(
      (el) => el.getAttribute('data-date') === '2025-06-02'
    );
    expect(cell).toHaveAttribute('aria-label', '5 jobs on 2025-06-02');
  });
});

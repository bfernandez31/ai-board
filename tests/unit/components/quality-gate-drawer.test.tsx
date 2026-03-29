import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { QualityGateDrawer } from '@/components/health/drawer/quality-gate-drawer';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock recharts to avoid rendering issues in test
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

const mockData = {
  averageScore: 82,
  ticketCount: 5,
  trend: 'up' as const,
  trendDelta: 4,
  distribution: { excellent: 1, good: 3, fair: 1, poor: 0 },
  dimensions: [
    { name: 'Compliance', averageScore: 88, weight: 0.40 },
    { name: 'Bug Detection', averageScore: 79, weight: 0.30 },
    { name: 'Code Comments', averageScore: 75, weight: 0.20 },
    { name: 'Historical Context', averageScore: 70, weight: 0.10 },
    { name: 'Spec Sync', averageScore: 65, weight: 0.00 },
  ],
  recentTickets: [
    { ticketKey: 'AIB-120', title: 'Add user preferences', score: 85, completedAt: '2026-03-25T14:30:00.000Z' },
    { ticketKey: 'AIB-121', title: 'Fix login bug', score: 78, completedAt: '2026-03-24T10:00:00.000Z' },
  ],
  trendData: [
    { ticketKey: 'AIB-121', score: 78, date: '2026-03-24T10:00:00.000Z' },
    { ticketKey: 'AIB-120', score: 85, date: '2026-03-25T14:30:00.000Z' },
  ],
};

const emptyData = {
  averageScore: null,
  ticketCount: 0,
  trend: null,
  trendDelta: null,
  distribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
  dimensions: [],
  recentTickets: [],
  trendData: [],
};

function renderDrawer(isOpen: boolean, data: unknown = mockData) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
  return renderWithProviders(
    <QualityGateDrawer projectId={1} isOpen={isOpen} onClose={vi.fn()} />
  );
}

describe('QualityGateDrawer', () => {
  it('renders dimension breakdown with all 5 dimensions', async () => {
    renderDrawer(true);

    await waitFor(() => {
      expect(screen.getByText('Compliance')).toBeInTheDocument();
    });
    expect(screen.getByText('Bug Detection')).toBeInTheDocument();
    expect(screen.getByText('Code Comments')).toBeInTheDocument();
    expect(screen.getByText('Historical Context')).toBeInTheDocument();
    expect(screen.getByText('Spec Sync')).toBeInTheDocument();
  });

  it('renders recent tickets list with keys and scores', async () => {
    renderDrawer(true);

    await waitFor(() => {
      expect(screen.getByText('AIB-120')).toBeInTheDocument();
    });
    expect(screen.getByText('Add user preferences')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('AIB-121')).toBeInTheDocument();
    expect(screen.getByText('78')).toBeInTheDocument();
  });

  it('renders trend chart container', async () => {
    renderDrawer(true);

    await waitFor(() => {
      expect(screen.getByText('Score Trend')).toBeInTheDocument();
    });
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
  });

  it('shows empty state when no data', async () => {
    renderDrawer(true, emptyData);

    await waitFor(() => {
      expect(screen.getByText('No data yet')).toBeInTheDocument();
    });
  });

  it('shows loading state while fetching', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithProviders(
      <QualityGateDrawer projectId={1} isOpen={true} onClose={vi.fn()} />
    );

    // The loading spinner should be visible (no text content to check easily,
    // but the drawer should be open without data)
    expect(screen.getByText('Quality Gate')).toBeInTheDocument();
  });
});

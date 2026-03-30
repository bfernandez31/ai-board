import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { QualityGateDrawerContent } from '@/components/health/drawer/quality-gate-drawer-content';
import type { QualityGateModuleStatus } from '@/lib/health/types';

// Mock recharts to avoid DOM measurement issues in test env
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
}));

const moduleWithData: QualityGateModuleStatus = {
  score: 75,
  label: 'Good',
  lastScanDate: '2026-03-28T14:30:00.000Z',
  passive: true,
  summary: '5 tickets in 30 days',
  ticketCount: 5,
  trend: { type: 'improvement', delta: 15, previousAverage: 60 },
  distribution: { excellent: 1, good: 2, fair: 1, poor: 1 },
  detail: {
    dimensions: [
      { name: 'Compliance', averageScore: 82, weight: 0.40 },
      { name: 'Bug Detection', averageScore: 70, weight: 0.30 },
      { name: 'Code Comments', averageScore: 65, weight: 0.20 },
      { name: 'Historical Context', averageScore: 58, weight: 0.10 },
      { name: 'Spec Sync', averageScore: null, weight: 0.00 },
    ],
    recentTickets: [
      { ticketKey: 'AIB-350', title: 'Add user profile page', score: 95, label: 'Excellent', completedAt: '2026-03-28T14:30:00.000Z' },
      { ticketKey: 'AIB-348', title: 'Fix login redirect', score: 82, label: 'Good', completedAt: '2026-03-25T10:00:00.000Z' },
    ],
    trendData: [
      { week: 'Mar 3-9', averageScore: 60, ticketCount: 2 },
      { week: 'Mar 24-30', averageScore: 80, ticketCount: 2 },
    ],
  },
};

const moduleEmpty: QualityGateModuleStatus = {
  score: null,
  label: null,
  lastScanDate: null,
  passive: true,
  summary: 'No qualifying tickets',
  ticketCount: 0,
  trend: { type: 'no_data', delta: null, previousAverage: null },
  distribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
  detail: null,
};

describe('QualityGateDrawerContent', () => {
  it('renders dimensions table with correct averages', () => {
    renderWithProviders(<QualityGateDrawerContent module={moduleWithData} />);

    expect(screen.getByText('Quality Dimensions')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Bug Detection')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();
    expect(screen.getByText('Code Comments')).toBeInTheDocument();
    expect(screen.getByText('65')).toBeInTheDocument();
    expect(screen.getByText('Historical Context')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    // Spec Sync has null score
    expect(screen.getByText('Spec Sync')).toBeInTheDocument();
    expect(screen.getAllByText('---').length).toBeGreaterThanOrEqual(1);
  });

  it('renders recent tickets list with score badges', () => {
    renderWithProviders(<QualityGateDrawerContent module={moduleWithData} />);

    expect(screen.getByText('Recent SHIP Tickets')).toBeInTheDocument();
    expect(screen.getByText('AIB-350')).toBeInTheDocument();
    expect(screen.getByText('Add user profile page')).toBeInTheDocument();
    expect(screen.getByText('95 Excellent')).toBeInTheDocument();
    expect(screen.getByText('AIB-348')).toBeInTheDocument();
    expect(screen.getByText('82 Good')).toBeInTheDocument();
  });

  it('renders trend chart', () => {
    renderWithProviders(<QualityGateDrawerContent module={moduleWithData} />);

    expect(screen.getByText('Score Trend')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('renders empty state when detail is null', () => {
    renderWithProviders(<QualityGateDrawerContent module={moduleEmpty} />);

    expect(screen.getByText('No data available yet')).toBeInTheDocument();
    expect(screen.queryByText('Quality Dimensions')).not.toBeInTheDocument();
  });
});

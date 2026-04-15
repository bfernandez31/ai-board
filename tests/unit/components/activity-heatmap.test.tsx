import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { HeatmapData } from '@/lib/heatmap/types';

// Mock next/navigation
const mockPush = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}));

// Import component after mocks
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';

function createMockHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return {
    days: {
      [todayKey]: {
        jobCount: 3,
        costUsd: 2.5,
        ticketsShipped: ['AIB-100'],
      },
    },
    summary: {
      totalJobs: 15,
      ticketsShipped: 3,
    },
    availableAgents: [
      { value: 'all', label: 'All' },
      { value: 'CLAUDE', label: 'Claude' },
      { value: 'CODEX', label: 'Codex' },
    ],
    availableYears: [2025, 2026],
    userCreatedAt: '2025-01-01T00:00:00.000Z',
    filters: { year: 'rolling', agent: 'all' },
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders the header with job and ticket counts', () => {
    const data = createMockHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByText(/15/)).toBeInTheDocument();
    expect(screen.getByText(/jobs/)).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/shipped/)).toBeInTheDocument();
  });

  it('renders the heatmap grid when there is activity', () => {
    const data = createMockHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    // Grid should be rendered (not the empty state)
    expect(screen.queryByText(/No activity to show yet/)).not.toBeInTheDocument();
  });

  it('shows empty state message when no activity', () => {
    const data = createMockHeatmapData({
      days: {},
      summary: { totalJobs: 0, ticketsShipped: 0 },
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByText(/No activity to show yet/)).toBeInTheDocument();
  });

  it('shows legend with Less and More labels', () => {
    const data = createMockHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('shows year selector when multiple years available', () => {
    const data = createMockHeatmapData({
      availableYears: [2025, 2026],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    // Year selector should show "Last 12 months" as default
    expect(screen.getByText('Last 12 months')).toBeInTheDocument();
  });

  it('hides agent filter when only 0 or 1 distinct agents', () => {
    const data = createMockHeatmapData({
      availableAgents: [{ value: 'all', label: 'All' }],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    // Should not show any agent filter options
    expect(screen.queryByText('Claude')).not.toBeInTheDocument();
    expect(screen.queryByText('Codex')).not.toBeInTheDocument();
  });

  it('shows agent filter when 2+ distinct agents exist', () => {
    const data = createMockHeatmapData({
      availableAgents: [
        { value: 'all', label: 'All' },
        { value: 'CLAUDE', label: 'Claude' },
        { value: 'CODEX', label: 'Codex' },
      ],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    // Agent filter trigger should be present
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('renders day-of-week labels', () => {
    const data = createMockHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    // Only odd-indexed labels are visible (Mon, Wed, Fri)
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
  });

  it('handles singular job/ticket count correctly', () => {
    const data = createMockHeatmapData({
      summary: { totalJobs: 1, ticketsShipped: 1 },
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByText(/1 job/)).toBeInTheDocument();
    expect(screen.getByText(/1 ticket shipped/)).toBeInTheDocument();
  });
});

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/activity-heatmap/activity-heatmap';
import type { ActivityHeatmapResponse, HeatmapFilters } from '@/lib/heatmap/types';

const pushMock = vi.fn();
let mockSearchParams = new URLSearchParams();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

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

function makeHeatmapData(overrides: Partial<ActivityHeatmapResponse> = {}): ActivityHeatmapResponse {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayKey = `${year}-${month}-${day}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
  const yDay = String(yesterday.getDate()).padStart(2, '0');
  const yesterdayKey = `${year}-${yMonth}-${yDay}`;

  const startDate = new Date(today);
  startDate.setFullYear(startDate.getFullYear() - 1);
  startDate.setDate(startDate.getDate() + 1);
  const sMonth = String(startDate.getMonth() + 1).padStart(2, '0');
  const sDay = String(startDate.getDate()).padStart(2, '0');
  const startKey = `${startDate.getFullYear()}-${sMonth}-${sDay}`;

  return {
    days: {
      [todayKey]: { jobCount: 5, shippedCount: 1, costUsd: 2.40 },
      [yesterdayKey]: { jobCount: 3, shippedCount: 0, costUsd: null },
    },
    thresholds: { q25: 2, q50: 4, q75: 6, q90: 8 },
    summary: { totalJobs: 8, ticketsShipped: 1 },
    period: { startDate: startKey, endDate: todayKey },
    availableYears: ['rolling', '2025', '2026'],
    availableAgents: [
      { value: 'all', label: 'All' },
      { value: 'CLAUDE', label: 'Claude' },
    ],
    filters: { year: 'rolling', agent: 'all' },
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockClear();
    fetchMock.mockClear();
    mockSearchParams = new URLSearchParams();
    globalThis.fetch = fetchMock.mockResolvedValue({
      ok: true,
      json: async () => makeHeatmapData(),
    } as Response);
  });

  it('renders heatmap with grid cells', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
    const cells = screen.getAllByTestId('heatmap-cell');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('displays summary counters', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
    const summary = screen.getByTestId('heatmap-summary');
    expect(summary.textContent).toContain('8');
    expect(summary.textContent).toContain('jobs');
    expect(summary.textContent).toContain('1');
    expect(summary.textContent).toContain('tickets shipped');
  });

  it('shows intensity legend', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
    const legend = screen.getByTestId('heatmap-legend');
    expect(legend.textContent).toContain('Less');
    expect(legend.textContent).toContain('More');
  });

  it('shows empty state when totalJobs is 0', () => {
    const data = makeHeatmapData({
      days: {},
      summary: { totalJobs: 0, ticketsShipped: 0 },
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    const empty = screen.getByTestId('heatmap-empty');
    expect(empty.textContent).toContain('No activity to show yet');
    expect(screen.getByTestId('heatmap-legend')).toBeTruthy();
  });

  it('does not show loading flash with initialData', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
    expect(screen.getByTestId('activity-heatmap')).toBeTruthy();
    expect(screen.queryByText('Loading')).toBeNull();
  });

  describe('Year Selector (US2)', () => {
    it('renders year selector with correct options', () => {
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
      const select = screen.getByTestId('heatmap-year-select');
      expect(select).toBeTruthy();
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(3);
    });

    it('hides year selector when only one option (FR-008)', () => {
      const data = makeHeatmapData({ availableYears: ['rolling'] });
      renderWithProviders(<ActivityHeatmap initialData={data} />);
      expect(screen.queryByTestId('heatmap-year-select')).toBeNull();
    });

    it('selecting a year triggers URL update', () => {
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
      const select = screen.getByTestId('heatmap-year-select');
      fireEvent.change(select, { target: { value: '2025' } });
      expect(pushMock).toHaveBeenCalledWith(
        expect.stringContaining('year=2025'),
        { scroll: false }
      );
    });
  });

  describe('Agent Filter (US3)', () => {
    it('renders agent filter with correct options', () => {
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
      const select = screen.getByTestId('heatmap-agent-select');
      expect(select).toBeTruthy();
      const options = select.querySelectorAll('option');
      expect(options).toHaveLength(2);
    });

    it('hides agent filter when only one agent (FR-010)', () => {
      const data = makeHeatmapData({
        availableAgents: [{ value: 'all', label: 'All' }],
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);
      expect(screen.queryByTestId('heatmap-agent-select')).toBeNull();
    });

    it('selecting agent triggers URL update', () => {
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
      const select = screen.getByTestId('heatmap-agent-select');
      fireEvent.change(select, { target: { value: 'CLAUDE' } });
      expect(pushMock).toHaveBeenCalledWith(
        expect.stringContaining('agent=CLAUDE'),
        { scroll: false }
      );
    });
  });

  describe('URL Sync (US5)', () => {
    it('restores filters from URL query params on load', async () => {
      mockSearchParams = new URLSearchParams('year=2025&agent=CLAUDE');
      const data = makeHeatmapData({ filters: { year: '2025', agent: 'CLAUDE' } });
      fetchMock.mockResolvedValue({ ok: true, json: async () => data } as Response);
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
      await waitFor(() => {
        const select = screen.getByTestId('heatmap-year-select') as HTMLSelectElement;
        expect(select.value).toBe('2025');
      });
    });

    it('default filters produce clean URL', () => {
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
      const yearSelect = screen.getByTestId('heatmap-year-select');
      fireEvent.change(yearSelect, { target: { value: 'rolling' } });
      expect(pushMock).toHaveBeenCalledWith('?', { scroll: false });
    });
  });

  describe('Mobile (US6)', () => {
    it('grid container has overflow-x-auto', () => {
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
      const container = screen.getByTestId('heatmap-grid-container');
      expect(container.className).toContain('overflow-x-auto');
    });
  });
});

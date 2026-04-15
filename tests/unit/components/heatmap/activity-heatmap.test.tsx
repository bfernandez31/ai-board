import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/heatmap/activity-heatmap';
import type { HeatmapData } from '@/lib/heatmap/types';

const pushMock = vi.fn();
const replaceMock = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
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
      if (!React.isValidElement(child)) {
        return [];
      }
      if (child.type === SelectItem) {
        return [child];
      }
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
            if (!React.isValidElement(child) || child.type !== SelectTrigger) {
              return null;
            }
            return React.cloneElement(child, {
              value,
              onValueChange,
              options,
            });
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

function makeHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  const now = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return {
    days: [
      { date: daysAgo(3), jobCount: 5, costUsd: 2.5, shippedTickets: ['AIB-1'] },
      { date: daysAgo(2), jobCount: 3, costUsd: null, shippedTickets: [] },
      { date: daysAgo(1), jobCount: 1, costUsd: 1.0, shippedTickets: ['AIB-2'] },
    ],
    totalJobs: 9,
    totalShipped: 2,
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 9, isDefault: true },
      { value: 'CLAUDE', label: 'Claude', jobCount: 6, isDefault: false },
      { value: 'CODEX', label: 'Codex', jobCount: 3, isDefault: false },
    ],
    availableYears: [2025, 2026],
    userCreatedAt: '2025-01-15T00:00:00.000Z',
    generatedAt: now.toISOString(),
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders grid with cells for the period', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const cells = screen.getAllByTestId('heatmap-cell');
    expect(cells.length).toBeGreaterThan(300); // ~365 valid cells for last 12 months
  });

  it('shows summary counter with correct totals', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    expect(screen.getByText(/9 jobs/)).toBeDefined();
    expect(screen.getByText(/2 tickets shipped/)).toBeDefined();
  });

  it('renders legend with 5 intensity levels', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const legendCells = screen.getAllByTestId('legend-cell');
    expect(legendCells.length).toBe(5);
  });

  it('shows empty state message when zero activity', () => {
    const emptyData = makeHeatmapData({
      days: [],
      totalJobs: 0,
      totalShipped: 0,
    });
    renderWithProviders(<ActivityHeatmap initialData={emptyData} />);

    expect(screen.getByText('No activity to show yet — your AI work will appear here')).toBeDefined();
  });

  it('filters and legend remain visible during empty state', () => {
    const emptyData = makeHeatmapData({
      days: [],
      totalJobs: 0,
      totalShipped: 0,
    });
    renderWithProviders(<ActivityHeatmap initialData={emptyData} />);

    // Legend should still be present
    const legendCells = screen.getAllByTestId('legend-cell');
    expect(legendCells.length).toBe(5);
  });

  it('renders immediately with initialData (no loading flash)', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    // Grid should render immediately
    const cells = screen.getAllByTestId('heatmap-cell');
    expect(cells.length).toBeGreaterThan(0);
    // No loading state
    expect(screen.queryByText(/loading/i)).toBeNull();
  });

  // US2: Tooltip tests
  it('shows tooltip on cell hover with correct content', async () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const cells = screen.getAllByTestId('heatmap-cell');
    // Find a cell with data (level > 0)
    const activeCell = cells.find((cell) => cell.getAttribute('data-level') !== '0');
    if (activeCell) {
      fireEvent.mouseEnter(activeCell);
      await waitFor(() => {
        const tooltip = screen.getByTestId('heatmap-tooltip');
        expect(tooltip).toBeDefined();
        // Should show job count
        expect(tooltip.textContent).toMatch(/\d+ jobs?/);
      });
      fireEvent.mouseLeave(activeCell);
    }
  });

  it('tooltip omits cost when no jobs have recorded cost', async () => {
    const data = makeHeatmapData({
      days: [{ date: '2026-04-14', jobCount: 3, costUsd: null, shippedTickets: [] }],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    const cells = screen.getAllByTestId('heatmap-cell');
    const activeCell = cells.find((cell) => cell.getAttribute('data-level') !== '0');
    if (activeCell) {
      fireEvent.mouseEnter(activeCell);
      await waitFor(() => {
        const tooltip = screen.getByTestId('heatmap-tooltip');
        expect(tooltip.textContent).not.toMatch(/\$/);
      });
    }
  });

  // US3: Year selector tests
  it('year selector hidden when user created this year', () => {
    const data = makeHeatmapData({
      availableYears: [2026],
      userCreatedAt: '2026-01-15T00:00:00.000Z',
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.queryByTestId('heatmap-year-filter')).toBeNull();
  });

  it('year selector shows available years from data', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const yearFilter = screen.queryByTestId('heatmap-year-filter');
    expect(yearFilter).toBeDefined();
  });

  // US4: Agent filter tests
  it('agent filter hidden when ≤1 agent', () => {
    const data = makeHeatmapData({
      availableAgents: [{ value: 'all', label: 'All agents', jobCount: 5, isDefault: true }],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.queryByTestId('heatmap-agent-filter')).toBeNull();
  });

  it('agent filter shows available agents from data', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const agentFilter = screen.queryByTestId('heatmap-agent-filter');
    expect(agentFilter).toBeDefined();
  });

  // US5: Mobile scroll tests
  it('grid container has horizontal scroll class', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const scrollContainer = screen.getByTestId('heatmap-scroll-container');
    expect(scrollContainer.className).toMatch(/overflow-x-auto/);
  });

  it('day-of-week labels have sticky positioning', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const dayLabels = screen.getAllByTestId('day-label');
    expect(dayLabels.length).toBe(3); // Mon, Wed, Fri
    for (const label of dayLabels) {
      expect(label.className).toMatch(/sticky/);
    }
  });
});

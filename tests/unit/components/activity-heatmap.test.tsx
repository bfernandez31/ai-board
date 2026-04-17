import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/activity-heatmap/activity-heatmap';
import type { HeatmapCell, HeatmapData } from '@/lib/analytics/activity-heatmap';

const pushMock = vi.fn();
const mockSearchParams = new URLSearchParams();

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

// Use a transparent <select> to make testing trivial.
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

function makeCells(start: string, days: number, pattern: (i: number) => Partial<HeatmapCell> = () => ({})): HeatmapCell[] {
  const cells: HeatmapCell[] = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const cursor = new Date(Date.UTC(sy!, sm! - 1, sd!));
  for (let i = 0; i < days; i++) {
    const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
    cells.push({ date: key, jobCount: 0, totalCost: null, ticketsShipped: 0, ...pattern(i) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}

function makeHeatmap(overrides: Partial<HeatmapData> = {}): HeatmapData {
  return {
    startDate: '2025-01-01',
    endDate: '2025-01-07',
    cells: makeCells('2025-01-01', 7, (i) => ({ jobCount: i, totalCost: i > 0 ? i * 0.5 : null, ticketsShipped: i === 2 ? 1 : 0 })),
    totalJobs: 21,
    totalShipped: 1,
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 21 },
      { value: 'CLAUDE', label: 'Claude', jobCount: 14 },
      { value: 'CODEX', label: 'Codex', jobCount: 7 },
    ],
    availableYears: [2026, 2025, 2024],
    filters: { agent: 'all', period: { kind: 'rolling', months: 12 } },
    generatedAt: '2026-04-17T00:00:00.000Z',
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockReset();
    Array.from(mockSearchParams.keys()).forEach((k) => mockSearchParams.delete(k));
  });

  it('renders the header counter with jobs and tickets shipped', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmap()} />);
    const counter = screen.getByTestId('activity-heatmap-counter');
    expect(counter.textContent).toContain('21 jobs');
    expect(counter.textContent).toContain('1 ticket');
    expect(counter.textContent).toContain('shipped');
    expect(counter.textContent).toContain('in the last year');
  });

  it('shows the empty state when there is zero activity', () => {
    const empty = makeHeatmap({
      totalJobs: 0,
      totalShipped: 0,
      cells: makeCells('2025-01-01', 7),
    });
    renderWithProviders(<ActivityHeatmap initialData={empty} />);
    expect(screen.getByTestId('activity-heatmap-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('activity-heatmap-grid')).not.toBeInTheDocument();
  });

  it('hides the agent filter when 0 or 1 distinct agents are present', () => {
    const data = makeHeatmap({
      availableAgents: [
        { value: 'all', label: 'All agents', jobCount: 5 },
        { value: 'CLAUDE', label: 'Claude', jobCount: 5 },
      ],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    expect(screen.queryByTestId('activity-heatmap-agent-filter')).not.toBeInTheDocument();
  });

  it('shows the agent filter when 2+ distinct agents are present', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmap()} />);
    expect(screen.getByTestId('activity-heatmap-agent-filter')).toBeInTheDocument();
  });

  it('hides the year selector when user has no prior years', () => {
    const data = makeHeatmap({ availableYears: [] });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    expect(screen.queryByTestId('activity-heatmap-year-selector')).not.toBeInTheDocument();
  });

  it('writes agent filter into the URL as query params', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmap()} />);
    const select = screen.getByTestId('activity-heatmap-agent-filter') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'CODEX' } });
    expect(pushMock).toHaveBeenCalledWith(
      expect.stringContaining('heatmapAgent=CODEX'),
      expect.objectContaining({ scroll: false })
    );
  });

  it('omits the cost line in the tooltip when the day has no recorded cost', () => {
    const data = makeHeatmap({
      cells: [
        { date: '2025-01-01', jobCount: 2, totalCost: null, ticketsShipped: 0 },
        ...makeCells('2025-01-02', 6),
      ],
      totalJobs: 2,
      totalShipped: 0,
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    const cell = screen.getByTestId('activity-cell-2025-01-01');
    fireEvent.mouseEnter(cell);
    const tooltip = screen.getByTestId('activity-heatmap-tooltip');
    expect(tooltip.textContent).toContain('2 jobs');
    expect(tooltip.textContent).not.toContain('$NaN');
    expect(tooltip.textContent).not.toMatch(/\$0\.00(?!\d)/); // should not show $0.00 for missing cost
  });

  it('shows cost in the tooltip when recorded cost exists', () => {
    const data = makeHeatmap({
      cells: [
        { date: '2025-01-01', jobCount: 3, totalCost: 2.5, ticketsShipped: 1 },
        ...makeCells('2025-01-02', 6),
      ],
      totalJobs: 3,
      totalShipped: 1,
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    const cell = screen.getByTestId('activity-cell-2025-01-01');
    fireEvent.mouseEnter(cell);
    const tooltip = screen.getByTestId('activity-heatmap-tooltip');
    expect(tooltip.textContent).toContain('$2.50');
    expect(tooltip.textContent).toContain('1 ticket');
  });
});

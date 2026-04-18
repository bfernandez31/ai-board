import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { HeatmapData } from '@/lib/heatmap/types';

const pushMock = vi.fn();
const replaceMock = vi.fn();
let mockSearchParams = new URLSearchParams();

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

function makeHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));

  const cells = overrides.cells ?? [
    { date: start.toISOString().split('T')[0]!, jobCount: 3, shippedCount: 1, totalCost: 1.5 },
    { date: end.toISOString().split('T')[0]!, jobCount: 7, shippedCount: 2, totalCost: null },
  ];

  return {
    cells,
    summary: overrides.summary ?? { totalJobs: 10, totalShipped: 3 },
    thresholds: overrides.thresholds ?? [2, 5, 8, 10],
    availableAgents: overrides.availableAgents ?? [
      { value: 'all', label: 'All agents', jobCount: 10, isDefault: true },
    ],
    availableYears: overrides.availableYears ?? ['2025', '2026'],
    accountCreatedYear: overrides.accountCreatedYear ?? 2025,
    filters: overrides.filters ?? { year: 'rolling', agent: 'all' },
  };
}

// Lazy import to allow mocks to register first
async function importActivityHeatmap() {
  const mod = await import('@/components/heatmap/activity-heatmap');
  return mod.ActivityHeatmap;
}

describe('ActivityHeatmap Component', () => {
  beforeEach(() => {
    pushMock.mockClear();
    replaceMock.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  it('renders heatmap with cells', async () => {
    const ActivityHeatmap = await importActivityHeatmap();
    const data = makeHeatmapData();
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByTestId('activity-heatmap')).toBeDefined();
    expect(screen.getByTestId('heatmap-grid')).toBeDefined();
    expect(screen.getByTestId('heatmap-header')).toBeDefined();
    expect(screen.getByTestId('heatmap-legend')).toBeDefined();
  });

  it('displays summary counter with correct totals', async () => {
    const ActivityHeatmap = await importActivityHeatmap();
    const data = makeHeatmapData({ summary: { totalJobs: 42, totalShipped: 7 } });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    const summary = screen.getByTestId('heatmap-summary');
    expect(summary.textContent).toContain('42 jobs');
    expect(summary.textContent).toContain('7 tickets shipped');
  });

  it('renders intensity legend with 5 swatches', async () => {
    const ActivityHeatmap = await importActivityHeatmap();
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const swatches = screen.getAllByTestId('legend-swatch');
    expect(swatches.length).toBe(5);
  });

  it('shows empty state when cells array is empty', async () => {
    const ActivityHeatmap = await importActivityHeatmap();
    const data = makeHeatmapData({
      cells: [],
      summary: { totalJobs: 0, totalShipped: 0 },
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);

    expect(screen.getByTestId('heatmap-empty-state')).toBeDefined();
    expect(screen.getByText(/No activity to show yet/)).toBeDefined();
  });

  it('shows month labels and day-of-week labels', async () => {
    const ActivityHeatmap = await importActivityHeatmap();
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const dayLabels = screen.getAllByTestId('day-label');
    expect(dayLabels.length).toBe(3);
    expect(dayLabels[0]?.textContent).toBe('Mon');
    expect(dayLabels[1]?.textContent).toBe('Wed');
    expect(dayLabels[2]?.textContent).toBe('Fri');
  });

  it('renders with initialData without showing loading state', async () => {
    const ActivityHeatmap = await importActivityHeatmap();
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    expect(screen.queryByText(/loading/i)).toBeNull();
    expect(screen.getByTestId('heatmap-grid')).toBeDefined();
  });
});

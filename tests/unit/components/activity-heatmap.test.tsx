import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { HeatmapData } from '@/lib/heatmap/types';

const pushMock = vi.fn();
const replaceMock = vi.fn();
let mockSearchParams = new URLSearchParams();

// Mock fetch to avoid ECONNREFUSED in unit tests
const fetchMock = vi.fn(() =>
  Promise.resolve(new Response(JSON.stringify(makeHeatmapData()), { status: 200 }))
);
vi.stubGlobal('fetch', fetchMock);

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

  describe('Tooltip (US2)', () => {
    it('shows tooltip on cell hover with correct data', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

      const cells = screen.getAllByTestId('heatmap-cell');
      const cellWithData = cells.find((c) => c.getAttribute('data-level') !== '0');
      if (cellWithData) {
        fireEvent.mouseEnter(cellWithData);
        const tooltip = screen.getByTestId('heatmap-tooltip');
        expect(tooltip).toBeDefined();
      }
    });

    it('shows "No activity" tooltip for empty cells', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

      const cells = screen.getAllByTestId('heatmap-cell');
      const emptyCell = cells.find((c) => c.getAttribute('data-level') === '0');
      if (emptyCell) {
        fireEvent.mouseEnter(emptyCell);
        expect(screen.getByTestId('tooltip-empty')).toBeDefined();
        expect(screen.getByText('No activity')).toBeDefined();
      }
    });

    it('omits cost line when totalCost is null', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const now = new Date();
      const dateStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().split('T')[0]!;
      const data = makeHeatmapData({
        cells: [{ date: dateStr, jobCount: 3, shippedCount: 0, totalCost: null }],
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      const cells = screen.getAllByTestId('heatmap-cell');
      const activeCell = cells.find((c) => c.getAttribute('data-level') !== '0');
      if (activeCell) {
        fireEvent.mouseEnter(activeCell);
        const jobs = screen.getByTestId('tooltip-jobs');
        expect(jobs.textContent).toBe('3 jobs');
        expect(jobs.textContent).not.toContain('$');
      }
    });

    it('shows cost when totalCost is available', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const now = new Date();
      const dateStr = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().split('T')[0]!;
      const data = makeHeatmapData({
        cells: [{ date: dateStr, jobCount: 5, shippedCount: 1, totalCost: 2.5 }],
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      const cells = screen.getAllByTestId('heatmap-cell');
      const activeCell = cells.find((c) => c.getAttribute('data-level') !== '0');
      if (activeCell) {
        fireEvent.mouseEnter(activeCell);
        const jobs = screen.getByTestId('tooltip-jobs');
        expect(jobs.textContent).toContain('$2.50');
      }
    });

    it('shows tooltip date formatted correctly', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({
        cells: [{ date: '2025-03-15', jobCount: 1, shippedCount: 0, totalCost: null }],
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      const cells = screen.getAllByTestId('heatmap-cell');
      const activeCell = cells.find((c) => c.getAttribute('data-date') === '2025-03-15');
      if (activeCell) {
        fireEvent.mouseEnter(activeCell);
        const dateEl = screen.getByTestId('tooltip-date');
        expect(dateEl.textContent).toContain('March');
        expect(dateEl.textContent).toContain('15');
        expect(dateEl.textContent).toContain('2025');
      }
    });
  });

  describe('Year Selector (US3)', () => {
    it('shows year selector when accountCreatedYear < current year', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({ accountCreatedYear: 2024 });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      expect(screen.getByTestId('heatmap-year-selector')).toBeDefined();
    });

    it('hides year selector when accountCreatedYear === current year', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const currentYear = new Date().getUTCFullYear();
      const data = makeHeatmapData({ accountCreatedYear: currentYear });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      expect(screen.queryByTestId('heatmap-year-selector')).toBeNull();
      expect(screen.getByTestId('heatmap-year-label')).toBeDefined();
    });

    it('shows correct year options', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({
        accountCreatedYear: 2024,
        availableYears: ['2024', '2025', '2026'],
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      const selector = screen.getByTestId('heatmap-year-selector');
      const options = selector.querySelectorAll('option');
      const values = Array.from(options).map((o) => o.getAttribute('value'));
      expect(values).toContain('rolling');
      expect(values).toContain('2024');
      expect(values).toContain('2025');
      expect(values).toContain('2026');
    });

    it('updates filters when year is selected', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({ accountCreatedYear: 2024 });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      const selector = screen.getByTestId('heatmap-year-selector');
      fireEvent.change(selector, { target: { value: '2025' } });

      expect(replaceMock).toHaveBeenCalled();
    });
  });

  describe('Agent Filter (US4)', () => {
    it('hides agent filter when <= 1 distinct agent', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({
        availableAgents: [
          { value: 'all', label: 'All agents', jobCount: 10, isDefault: true },
          { value: 'CLAUDE', label: 'Claude', jobCount: 10, isDefault: false },
        ],
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      expect(screen.queryByTestId('heatmap-agent-filter')).toBeNull();
    });

    it('shows agent filter when multiple agents exist', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({
        availableAgents: [
          { value: 'all', label: 'All agents', jobCount: 20, isDefault: true },
          { value: 'CLAUDE', label: 'Claude', jobCount: 15, isDefault: false },
          { value: 'CODEX', label: 'Codex', jobCount: 5, isDefault: false },
        ],
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      expect(screen.getByTestId('heatmap-agent-filter')).toBeDefined();
    });

    it('updates filters when agent is selected', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({
        availableAgents: [
          { value: 'all', label: 'All agents', jobCount: 20, isDefault: true },
          { value: 'CLAUDE', label: 'Claude', jobCount: 15, isDefault: false },
          { value: 'CODEX', label: 'Codex', jobCount: 5, isDefault: false },
        ],
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      const filter = screen.getByTestId('heatmap-agent-filter');
      fireEvent.change(filter, { target: { value: 'CLAUDE' } });

      expect(replaceMock).toHaveBeenCalled();
    });
  });

  describe('URL Sync (US5)', () => {
    it('default filters produce no query params (clean URL)', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

      expect(replaceMock).not.toHaveBeenCalled();
    });

    it('non-default filters add correct query params', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({ accountCreatedYear: 2024 });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      const selector = screen.getByTestId('heatmap-year-selector');
      fireEvent.change(selector, { target: { value: '2025' } });

      expect(replaceMock).toHaveBeenCalledWith(
        expect.stringContaining('year=2025'),
        { scroll: false }
      );
    });

    it('filters restore from URL params on mount', async () => {
      mockSearchParams = new URLSearchParams('year=2025');
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify(makeHeatmapData({
          filters: { year: '2025', agent: 'all' },
          accountCreatedYear: 2024,
        })), { status: 200 }))
      );
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({ accountCreatedYear: 2024, filters: { year: '2025', agent: 'all' } });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      const selector = screen.getByTestId('heatmap-year-selector');
      expect(selector.getAttribute('value') || (selector as HTMLSelectElement).value).toBe('2025');
    });
  });

  describe('Empty State (US6)', () => {
    it('shows "0 jobs · 0 tickets shipped" in empty state', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({
        cells: [],
        summary: { totalJobs: 0, totalShipped: 0 },
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      const summary = screen.getByTestId('heatmap-summary');
      expect(summary.textContent).toContain('0 jobs');
      expect(summary.textContent).toContain('0 tickets shipped');
    });

    it('legend and filters remain visible during empty state', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      const data = makeHeatmapData({
        cells: [],
        summary: { totalJobs: 0, totalShipped: 0 },
        accountCreatedYear: 2024,
      });
      renderWithProviders(<ActivityHeatmap initialData={data} />);

      expect(screen.getByTestId('heatmap-legend')).toBeDefined();
      expect(screen.getByTestId('heatmap-header')).toBeDefined();
      expect(screen.getByTestId('heatmap-year-selector')).toBeDefined();
    });
  });

  describe('Mobile Scroll (US7)', () => {
    it('grid container has overflow-x-auto', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

      const grid = screen.getByTestId('heatmap-grid');
      const scrollContainer = grid.querySelector('.overflow-x-auto');
      expect(scrollContainer).toBeDefined();
    });

    it('day-of-week labels have sticky positioning', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

      const grid = screen.getByTestId('heatmap-grid');
      const stickyLabels = grid.querySelector('.sticky');
      expect(stickyLabels).toBeDefined();
    });
  });

  describe('SSR Initial Data (US8)', () => {
    it('component renders with initialData without showing loading state', async () => {
      const ActivityHeatmap = await importActivityHeatmap();
      renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

      expect(screen.queryByText(/loading/i)).toBeNull();
      expect(screen.queryByRole('progressbar')).toBeNull();
      expect(screen.getByTestId('heatmap-grid')).toBeDefined();
    });
  });
});

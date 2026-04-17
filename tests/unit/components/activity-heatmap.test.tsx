import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/activity/activity-heatmap';
import type { HeatmapResponse } from '@/lib/activity/heatmap-types';

const pushMock = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => currentSearchParams,
}));

// Mock shadcn Select with a native <select> so the DOM is testable.
vi.mock('@/components/ui/select', () => {
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );

  function collectOptions(children: React.ReactNode): React.ReactNode[] {
    return React.Children.toArray(children).flatMap((child) => {
      if (!React.isValidElement(child)) return [];
      if (child.type === SelectItem) return [child];
      return collectOptions(child.props.children);
    });
  }

  const SelectTrigger = ({
    value,
    options,
    disabled,
    onValueChange,
    'data-testid': dataTestId,
  }: {
    value?: string;
    options?: React.ReactNode[];
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    'data-testid'?: string;
  }) => (
    <select
      data-testid={dataTestId}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {options}
    </select>
  );

  return {
    Select: ({
      value,
      onValueChange,
      disabled,
      children,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      disabled?: boolean;
      children: React.ReactNode;
    }) => {
      const options = collectOptions(children);
      return (
        <>
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child) || child.type !== SelectTrigger) return null;
            return React.cloneElement(child, { value, onValueChange, disabled, options });
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

function makeHeatmap(overrides: Partial<HeatmapResponse> = {}): HeatmapResponse {
  return {
    filters: { year: 'last-12-months', agent: 'all', timezone: 'UTC' },
    range: {
      startDate: '2025-06-01',
      endDate: '2025-06-07',
      gridStart: '2025-06-01',
      gridEnd: '2025-06-07',
    },
    days: [
      { date: '2025-06-01', jobCount: 0, ticketsShipped: 0, intensity: 0 },
      { date: '2025-06-02', jobCount: 3, ticketsShipped: 1, intensity: 2, totalCostUsd: 1.42 },
      { date: '2025-06-03', jobCount: 2, ticketsShipped: 0, intensity: 2 },
      { date: '2025-06-04', jobCount: 0, ticketsShipped: 0, intensity: 0 },
      { date: '2025-06-05', jobCount: 5, ticketsShipped: 2, intensity: 3, totalCostUsd: 6 },
      { date: '2025-06-06', jobCount: 0, ticketsShipped: 0, intensity: 0 },
      { date: '2025-06-07', jobCount: 1, ticketsShipped: 0, intensity: 1 },
    ],
    counters: { totalJobs: 11, ticketsShipped: 3, periodLabel: 'in the last year' },
    agentOptions: [
      { value: 'all', label: 'All agents', historicalJobCount: 50 },
      { value: 'CLAUDE', label: 'Claude', historicalJobCount: 30 },
      { value: 'CODEX', label: 'Codex', historicalJobCount: 20 },
    ],
    yearOptions: [
      { value: 'last-12-months', label: 'Last 12 months', isDefault: true },
      { value: '2025', label: '2025', isDefault: false },
      { value: '2024', label: '2024', isDefault: false },
    ],
    generatedAt: '2025-06-07T00:00:00.000Z',
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockReset();
    currentSearchParams = new URLSearchParams();
  });

  it('renders counter, grid cells, and legend from initialData (no loader)', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmap()} />);

    expect(screen.getByTestId('activity-heatmap-counter').textContent).toContain('11 jobs');
    expect(screen.getByTestId('activity-heatmap-counter').textContent).toContain('3 tickets shipped');
    expect(screen.getByTestId('activity-heatmap-counter').textContent).toContain('in the last year');

    expect(screen.getByTestId('activity-heatmap-legend')).toBeTruthy();
    expect(screen.getAllByTestId('activity-heatmap-cell').length).toBe(7);

    expect(screen.queryByText(/Loading/i)).toBeNull();
  });

  it('renders centered empty-state message when totalJobs is 0 (legend stays visible)', () => {
    const emptyData = makeHeatmap({
      days: Array.from({ length: 7 }).map((_, i) => ({
        date: `2025-06-0${i + 1}`,
        jobCount: 0,
        ticketsShipped: 0,
        intensity: 0 as const,
      })),
      counters: { totalJobs: 0, ticketsShipped: 0, periodLabel: 'in the last year' },
    });

    renderWithProviders(<ActivityHeatmap initialData={emptyData} />);

    expect(
      screen.getByText(/No activity to show yet — your AI work will appear here/i)
    ).toBeTruthy();
    expect(screen.getByTestId('activity-heatmap-legend')).toBeTruthy();
    expect(screen.queryAllByTestId('activity-heatmap-cell').length).toBe(0);
  });

  it('hydrates filters from URL params (year=2025, agent=CLAUDE)', () => {
    currentSearchParams = new URLSearchParams({ year: '2025', agent: 'CLAUDE' });
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmap()} />);

    const yearSelect = screen.getByTestId('activity-heatmap-year-filter') as HTMLSelectElement;
    const agentSelect = screen.getByTestId('activity-heatmap-agent-filter') as HTMLSelectElement;
    expect(yearSelect.value).toBe('2025');
    expect(agentSelect.value).toBe('CLAUDE');
  });

  it('pushes new URL params with scroll:false when year changes', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmap()} />);
    const yearSelect = screen.getByTestId('activity-heatmap-year-filter') as HTMLSelectElement;
    fireEvent.change(yearSelect, { target: { value: '2025' } });
    expect(pushMock).toHaveBeenCalled();
    const [url, options] = pushMock.mock.calls[0]!;
    expect(String(url)).toContain('year=2025');
    expect(options).toEqual({ scroll: false });
  });

  it('hides agent filter when only one non-all agent exists', () => {
    const singleAgent = makeHeatmap({
      agentOptions: [
        { value: 'all', label: 'All agents', historicalJobCount: 10 },
        { value: 'CLAUDE', label: 'Claude', historicalJobCount: 10 },
      ],
    });
    renderWithProviders(<ActivityHeatmap initialData={singleAgent} />);
    expect(screen.queryByTestId('activity-heatmap-agent-filter')).toBeNull();
  });

  it('renders agent filter when two+ non-all agents exist', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmap()} />);
    expect(screen.getByTestId('activity-heatmap-agent-filter')).toBeTruthy();
  });

  it('disables year Select when only "Last 12 months" is available', () => {
    const currentYearOnly = makeHeatmap({
      yearOptions: [{ value: 'last-12-months', label: 'Last 12 months', isDefault: true }],
    });
    renderWithProviders(<ActivityHeatmap initialData={currentYearOnly} />);
    const yearSelect = screen.getByTestId('activity-heatmap-year-filter') as HTMLSelectElement;
    expect(yearSelect.disabled).toBe(true);
  });

  it('cell aria-label contains date and job count', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmap()} />);
    const cells = screen.getAllByTestId('activity-heatmap-cell');
    // 2025-06-02 is the active day with 3 jobs
    const active = cells.find((c) => c.getAttribute('data-date') === '2025-06-02')!;
    expect(active.getAttribute('aria-label')).toMatch(/3 jobs/);
  });
});

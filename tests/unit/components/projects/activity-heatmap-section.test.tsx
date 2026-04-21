/**
 * Component tests: ActivityHeatmapSection (AIB-704)
 *
 * Covers T014 (counter text, empty-state visibility, legend always visible),
 * T027 (period selector visibility + availableYears), T035 (agent filter
 * visibility), and T038 (URL sync via router.push).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from '@/tests/utils/component-test-utils';
import type { HeatmapData } from '@/lib/heatmap/types';

const pushMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParams,
}));

// Render shadcn Select as a native select so userEvent.selectOptions works.
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
      const nested: React.ReactNode | undefined = (child.props as { children?: React.ReactNode })
        .children;
      return nested ? collectOptions(nested) : [];
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

// Mock grid + legend + empty to keep the section test focused on its own concerns.
vi.mock('@/components/projects/activity-heatmap-grid', () => ({
  ActivityHeatmapGrid: ({
    days,
    startDate,
    endDate,
  }: {
    days: unknown[];
    startDate: string;
    endDate: string;
  }) => (
    <div
      data-testid="activity-heatmap-grid-stub"
      data-start={startDate}
      data-end={endDate}
      data-day-count={days.length}
    />
  ),
}));

vi.mock('@/components/projects/activity-heatmap-legend', () => ({
  ActivityHeatmapLegend: () => <div data-testid="activity-heatmap-legend" />,
}));

vi.mock('@/components/projects/activity-heatmap-empty', () => ({
  ActivityHeatmapEmpty: () => <div data-testid="activity-heatmap-empty" />,
}));

const { ActivityHeatmapSection } = await import(
  '@/components/projects/activity-heatmap-section'
);

function makeHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  return {
    filters: { period: { kind: 'rolling', months: 12 }, agent: 'all' },
    period: {
      startDate: '2025-04-21',
      endDate: '2026-04-21',
      label: 'the last year',
    },
    intensityThresholds: { t1: 1, t2: 2, t3: 3, t4: 4 },
    days: Array.from({ length: 366 }, (_, i) => ({
      date: `2025-04-${String((i % 28) + 1).padStart(2, '0')}`,
      jobCount: 0,
      sumCostUsd: 0,
      hasAnyCost: false,
      shippedTickets: [],
      intensity: 0 as const,
    })),
    totals: { jobs: 5, ticketsShipped: 2 },
    availableAgents: [],
    accountCreatedYear: 2023,
    generatedAt: '2026-04-21T12:00:00Z',
    ...overrides,
  };
}

describe('ActivityHeatmapSection', () => {
  beforeEach(() => {
    pushMock.mockReset();
    searchParams = new URLSearchParams();
  });

  it('renders counter text "{N} jobs · {M} tickets shipped in {label}" (FR-013)', () => {
    const data = makeHeatmapData({ totals: { jobs: 42, ticketsShipped: 7 } });
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );

    const counter = screen.getByTestId('activity-heatmap-counter');
    expect(counter.textContent).toContain('42');
    expect(counter.textContent).toContain('jobs');
    expect(counter.textContent).toContain('7');
    expect(counter.textContent).toContain('tickets shipped');
    expect(counter.textContent).toContain('the last year');
  });

  it('renders empty state when totals are zero and agent is all (Decision 11)', () => {
    const data = makeHeatmapData({
      totals: { jobs: 0, ticketsShipped: 0 },
      filters: { period: { kind: 'rolling', months: 12 }, agent: 'all' },
    });
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );

    expect(screen.getByTestId('activity-heatmap-empty')).toBeTruthy();
    expect(screen.queryByTestId('activity-heatmap-grid-stub')).toBeNull();
    // Legend is always present regardless of grid emptiness (FR-010)
    expect(screen.getByTestId('activity-heatmap-legend')).toBeTruthy();
  });

  it('renders grid (not empty state) when totals are non-zero', () => {
    const data = makeHeatmapData({ totals: { jobs: 3, ticketsShipped: 0 } });
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );
    expect(screen.queryByTestId('activity-heatmap-empty')).toBeNull();
    expect(screen.getByTestId('activity-heatmap-grid-stub')).toBeTruthy();
  });

  it('hides period selector when accountCreatedYear === currentYear (FR-015)', () => {
    const now = new Date();
    const data = makeHeatmapData();
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={now.getUTCFullYear()} />
    );
    expect(screen.queryByTestId('activity-heatmap-period-filter')).toBeNull();
  });

  it('shows period selector when accountCreatedYear is before current year', () => {
    const data = makeHeatmapData();
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );
    expect(screen.getByTestId('activity-heatmap-period-filter')).toBeTruthy();
  });

  it('hides agent filter when fewer than 2 effective agents (FR-018)', () => {
    const data = makeHeatmapData({
      availableAgents: [{ value: 'CLAUDE', label: 'Claude', jobCount: 5 }],
    });
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );
    expect(screen.queryByTestId('activity-heatmap-agent-filter')).toBeNull();
  });

  it('shows agent filter when 2+ effective agents (FR-018)', () => {
    const data = makeHeatmapData({
      availableAgents: [
        { value: 'CLAUDE', label: 'Claude', jobCount: 5 },
        { value: 'CODEX', label: 'Codex', jobCount: 3 },
      ],
    });
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );
    expect(screen.getByTestId('activity-heatmap-agent-filter')).toBeTruthy();
  });

  it('changing the period calls router.push with ?period=YYYY (FR-024)', async () => {
    const user = userEvent.setup();
    const data = makeHeatmapData();
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );

    const selector = screen.getByTestId('activity-heatmap-period-filter') as HTMLSelectElement;
    await user.selectOptions(selector, '2024');

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled();
    });
    const [url, options] = pushMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('period=2024');
    expect(options).toEqual(expect.objectContaining({ scroll: false }));
  });

  it('selecting "Last 12 months" removes period from URL (default omitted)', async () => {
    const user = userEvent.setup();
    searchParams = new URLSearchParams('period=2024');
    const data = makeHeatmapData({
      filters: { period: { kind: 'year', year: 2024 }, agent: 'all' },
    });
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );

    const selector = screen.getByTestId('activity-heatmap-period-filter') as HTMLSelectElement;
    await user.selectOptions(selector, '12m');

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled();
    });
    const url = String(pushMock.mock.calls[0]?.[0] ?? '');
    expect(url).not.toContain('period=');
  });

  it('changing agent to non-all adds ?agent=<enum>; agent=all removes it', async () => {
    const user = userEvent.setup();
    const data = makeHeatmapData({
      availableAgents: [
        { value: 'CLAUDE', label: 'Claude', jobCount: 5 },
        { value: 'CODEX', label: 'Codex', jobCount: 3 },
      ],
    });
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );

    const selector = screen.getByTestId('activity-heatmap-agent-filter') as HTMLSelectElement;
    await user.selectOptions(selector, 'CLAUDE');

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalled();
    });
    const url = String(pushMock.mock.calls[0]?.[0] ?? '');
    expect(url).toContain('agent=CLAUDE');
  });

  it('hydrates filters from searchParams on mount (FR-024)', () => {
    searchParams = new URLSearchParams('period=2024&agent=CODEX');
    const data = makeHeatmapData({
      filters: { period: { kind: 'year', year: 2024 }, agent: 'CODEX' },
      availableAgents: [
        { value: 'CLAUDE', label: 'Claude', jobCount: 5 },
        { value: 'CODEX', label: 'Codex', jobCount: 3 },
      ],
    });
    renderWithProviders(
      <ActivityHeatmapSection initialData={data} accountCreatedYear={2023} />
    );

    const periodSelect = screen.getByTestId('activity-heatmap-period-filter') as HTMLSelectElement;
    expect(periodSelect.value).toBe('2024');
    const agentSelect = screen.getByTestId('activity-heatmap-agent-filter') as HTMLSelectElement;
    expect(agentSelect.value).toBe('CODEX');
  });
});

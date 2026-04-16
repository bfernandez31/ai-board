import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import type { HeatmapData, HeatmapDayCell, HeatmapFilters } from '@/lib/heatmap/types';

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
            if (!React.isValidElement(child) || child.type !== SelectTrigger) {
              return null;
            }
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

function makeCell(overrides: Partial<HeatmapDayCell> = {}): HeatmapDayCell {
  return {
    date: overrides.date ?? '2026-04-01',
    inPeriod: overrides.inPeriod ?? true,
    jobCount: overrides.jobCount ?? 0,
    shippedTicketCount: overrides.shippedTicketCount ?? 0,
    totalCost: overrides.totalCost ?? null,
    intensityLevel: overrides.intensityLevel ?? 0,
  };
}

function makeHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  const filters: HeatmapFilters = overrides.filters ?? {
    period: 'last-12-months',
    agent: 'all',
  };
  return {
    filters,
    periodOptions: overrides.periodOptions ?? [
      { value: 'last-12-months', label: 'Last 12 months', isDefault: true },
    ],
    availableAgents: overrides.availableAgents ?? [],
    days: overrides.days ?? [
      makeCell({ date: '2025-04-13', inPeriod: true, jobCount: 0, intensityLevel: 0 }),
      makeCell({ date: '2025-04-14', inPeriod: true, jobCount: 3, intensityLevel: 2 }),
      makeCell({ date: '2026-04-15', inPeriod: true, jobCount: 5, intensityLevel: 4, totalCost: 1.25, shippedTicketCount: 1 }),
    ],
    totals: overrides.totals ?? { jobCount: 8, shippedTicketCount: 1 },
    intensityThresholds: overrides.intensityThresholds ?? [1, 2, 3, 5],
    generatedAt: overrides.generatedAt ?? '2026-04-16T00:00:00.000Z',
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockReset();
    Array.from(mockSearchParams.keys()).forEach((k) => mockSearchParams.delete(k));
    vi.restoreAllMocks();
  });

  it('renders cells from initialData without fetching and without a spinner', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderWithProviders(
      <ActivityHeatmap initialData={makeHeatmapData()} userCreatedYear={2023} />
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    expect(screen.getByText(/8 jobs · 1 ticket shipped in the last year/)).toBeInTheDocument();
  });

  it('renders empty-state copy when totals.jobCount is 0 (FR-015)', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          totals: { jobCount: 0, shippedTicketCount: 0 },
          days: [makeCell({ date: '2026-04-15', intensityLevel: 0 })],
        })}
        userCreatedYear={2023}
      />
    );

    expect(screen.getByText(/no activity yet/i)).toBeInTheDocument();
  });

  it('includes a 5-swatch legend (Less ... More)', () => {
    renderWithProviders(
      <ActivityHeatmap initialData={makeHeatmapData()} userCreatedYear={2023} />
    );

    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
    const swatches = screen.getAllByTestId('heatmap-legend-swatch');
    expect(swatches).toHaveLength(5);
  });

  it('hides agent filter when availableAgents is empty (FR-008)', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({ availableAgents: [] })}
        userCreatedYear={2023}
      />
    );
    expect(screen.queryByTestId('heatmap-agent-filter')).not.toBeInTheDocument();
  });

  it('shows period selector with descending years from userCreatedYear to current year', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          periodOptions: [
            { value: 'last-12-months', label: 'Last 12 months', isDefault: true },
            { value: '2026', label: '2026', isDefault: false },
            { value: '2025', label: '2025', isDefault: false },
            { value: '2024', label: '2024', isDefault: false },
          ],
        })}
        userCreatedYear={2024}
      />
    );

    expect(screen.getByTestId('heatmap-period-filter')).toHaveValue('last-12-months');
    expect(screen.getByRole('option', { name: 'Last 12 months' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '2024' })).toBeInTheDocument();
  });

  it('pushes new search params when period changes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(makeHeatmapData({ filters: { period: '2024', agent: 'all' } })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          periodOptions: [
            { value: 'last-12-months', label: 'Last 12 months', isDefault: true },
            { value: '2024', label: '2024', isDefault: false },
          ],
        })}
        userCreatedYear={2024}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByTestId('heatmap-period-filter'), {
        target: { value: '2024' },
      });
    });

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('?period=2024&agent=all', { scroll: false })
    );
  });

  it('shows agent filter with All + visible agents when >=1 available', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          availableAgents: [
            { value: 'CLAUDE', label: 'Claude', jobCount: 10 },
            { value: 'CODEX', label: 'Codex', jobCount: 5 },
          ],
        })}
        userCreatedYear={2023}
      />
    );

    const agentSelect = screen.getByTestId('heatmap-agent-filter');
    expect(agentSelect).toHaveValue('all');
    expect(screen.getByRole('option', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Claude' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Codex' })).toBeInTheDocument();
  });

  it('pushes agent param when agent changes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          makeHeatmapData({ filters: { period: 'last-12-months', agent: 'CLAUDE' } })
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );

    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          availableAgents: [
            { value: 'CLAUDE', label: 'Claude', jobCount: 10 },
            { value: 'CODEX', label: 'Codex', jobCount: 5 },
          ],
        })}
        userCreatedYear={2023}
      />
    );

    await act(async () => {
      fireEvent.change(screen.getByTestId('heatmap-agent-filter'), {
        target: { value: 'CLAUDE' },
      });
    });

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        '?period=last-12-months&agent=CLAUDE',
        { scroll: false }
      )
    );
  });

  it('renders day-of-week labels with sticky positioning for mobile', () => {
    const { container } = renderWithProviders(
      <ActivityHeatmap initialData={makeHeatmapData()} userCreatedYear={2023} />
    );
    const labels = container.querySelector('[data-testid="heatmap-dow-labels"]');
    expect(labels?.className ?? '').toContain('sticky');
    expect(labels?.className ?? '').toContain('left-0');
  });

  it('renders scroll wrapper for mobile horizontal overflow', () => {
    const { container } = renderWithProviders(
      <ActivityHeatmap initialData={makeHeatmapData()} userCreatedYear={2023} />
    );
    const wrapper = container.querySelector('[data-testid="heatmap-scroll"]');
    expect(wrapper?.className ?? '').toContain('overflow-x-auto');
  });

  it('renders clickable cell buttons for days with job activity', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          days: [
            makeCell({ date: '2026-04-15', inPeriod: true, jobCount: 5, totalCost: 1.25 }),
          ],
        })}
        userCreatedYear={2023}
      />
    );
    expect(screen.getByRole('button', { name: /2026-04-15: 5 jobs/ })).toBeInTheDocument();
  });

  it('does not render a button for empty-day cells (no hover tooltip surface)', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          days: [makeCell({ date: '2026-04-15', inPeriod: true, jobCount: 0 })],
        })}
        userCreatedYear={2023}
      />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

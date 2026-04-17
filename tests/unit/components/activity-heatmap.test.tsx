import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/activity-heatmap/activity-heatmap';
import type { HeatmapData } from '@/lib/activity-heatmap/types';

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
      return collectOptions(
        (child.props as { children?: React.ReactNode }).children
      );
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
            return React.cloneElement(child, { value, onValueChange, options } as Record<
              string,
              unknown
            >);
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
  return {
    filters: { period: 'last-12-months', agent: 'all' },
    periodStart: '2025-04-17',
    periodEnd: '2026-04-17',
    days: [
      { date: '2026-04-10', jobCount: 3, totalCost: 0.42, ticketsShipped: 1 },
      { date: '2026-04-12', jobCount: 8, totalCost: 1.5, ticketsShipped: 0 },
    ],
    totalJobs: 11,
    totalTicketsShipped: 1,
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 11 },
      { value: 'CLAUDE', label: 'Claude', jobCount: 7 },
      { value: 'CODEX', label: 'Codex', jobCount: 4 },
    ],
    availablePeriods: [
      { value: 'last-12-months', label: 'Last 12 months' },
      { value: '2026', label: '2026' },
      { value: '2025', label: '2025' },
    ],
    generatedAt: '2026-04-17T12:00:00.000Z',
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockSearchParams.delete('heatmapPeriod');
    mockSearchParams.delete('heatmapAgent');
    vi.restoreAllMocks();
  });

  it('renders header counter and grid cells for server-provided initial data', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    expect(screen.getByText(/11 jobs · 1 ticket shipped in the last year/i)).toBeInTheDocument();
    expect(screen.getByTestId('heatmap-legend')).toBeInTheDocument();
    expect(screen.getAllByTestId('heatmap-cell').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('heatmap-empty-state')).not.toBeInTheDocument();
  });

  it('hides the agent filter when the user has 0-1 distinct effective agents', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          availableAgents: [{ value: 'all', label: 'All agents', jobCount: 3 }],
        })}
      />
    );
    expect(screen.queryByTestId('heatmap-agent-filter')).not.toBeInTheDocument();
  });

  it('shows the agent filter when two or more distinct agents have activity', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
    expect(screen.getByTestId('heatmap-agent-filter')).toHaveValue('all');
    expect(screen.getByRole('option', { name: 'Claude' })).toBeInTheDocument();
  });

  it('shows the empty state when the period has zero activity but keeps filters/legend visible', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          days: [],
          totalJobs: 0,
          totalTicketsShipped: 0,
        })}
      />
    );
    expect(screen.getByTestId('heatmap-empty-state')).toHaveTextContent(
      /No activity to show yet/
    );
    expect(screen.getByTestId('heatmap-legend')).toBeInTheDocument();
    expect(screen.getByTestId('heatmap-period-filter')).toBeInTheDocument();
  });

  it('pushes filter changes to the URL so the view is shareable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(makeHeatmapData({ filters: { period: '2025', agent: 'all' } })), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    await act(async () => {
      fireEvent.change(screen.getByTestId('heatmap-period-filter'), {
        target: { value: '2025' },
      });
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        expect.stringContaining('heatmapPeriod=2025'),
        { scroll: false }
      );
    });
  });

  it('hides the period selector when the user was created in the current year (single option)', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          availablePeriods: [{ value: 'last-12-months', label: 'Last 12 months' }],
        })}
      />
    );
    expect(screen.queryByTestId('heatmap-period-filter')).not.toBeInTheDocument();
  });
});

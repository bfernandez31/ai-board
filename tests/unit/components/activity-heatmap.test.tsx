import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import type { HeatmapData } from '@/lib/heatmap/types';

const replaceMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
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
    onValueChange,
    disabled,
    'data-testid': dataTestId,
  }: {
    value?: string;
    options?: React.ReactNode[];
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    'data-testid'?: string;
  }) => (
    <select
      data-testid={dataTestId}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.value)}
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
            return React.cloneElement(child, { value, onValueChange, options, disabled });
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

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: () => null,
}));

import { ActivityHeatmap } from '@/components/projects/activity-heatmap/activity-heatmap';

function makeHeatmapData(overrides: Partial<HeatmapData> = {}): HeatmapData {
  return {
    startDate: '2025-04-20',
    endDate: '2026-04-19',
    days: [
      { date: '2026-04-10', jobCount: 3, totalCost: 1.5, shipped: 1 },
      { date: '2026-04-15', jobCount: 1, totalCost: null, shipped: 0 },
    ],
    totals: { jobCount: 4, ticketsShipped: 1 },
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 4 },
      { value: 'CLAUDE', label: 'Claude', jobCount: 3 },
      { value: 'CODEX', label: 'Codex', jobCount: 1 },
    ],
    availableYears: [2026, 2025, 2024],
    filters: { period: 'last12', agent: 'all' },
    generatedAt: '2026-04-19T12:00:00.000Z',
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    mockSearchParams = new URLSearchParams();
  });

  it('renders the counter with totals and the filter dropdowns', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
    expect(screen.getByTestId('activity-heatmap-counter')).toHaveTextContent(
      '4 jobs · 1 tickets shipped in the last 12 months'
    );
    expect(screen.getByTestId('activity-heatmap-agent-filter')).toBeInTheDocument();
    expect(screen.getByTestId('activity-heatmap-period-filter')).toBeInTheDocument();
  });

  it('hides the agent filter when only one agent is present', () => {
    const data = makeHeatmapData({
      availableAgents: [
        { value: 'all', label: 'All agents', jobCount: 4 },
        { value: 'CLAUDE', label: 'Claude', jobCount: 4 },
      ],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    expect(screen.queryByTestId('activity-heatmap-agent-filter')).toBeNull();
  });

  it('renders the empty state when the period has no activity', () => {
    const data = makeHeatmapData({
      totals: { jobCount: 0, ticketsShipped: 0 },
      days: [],
    });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    expect(screen.getByTestId('activity-heatmap-empty')).toHaveTextContent(
      'No activity to show yet — your AI work will appear here'
    );
    expect(screen.getByTestId('activity-heatmap-legend')).toBeInTheDocument();
  });

  it('writes filter changes back to the URL when the agent changes', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
    fireEvent.change(screen.getByTestId('activity-heatmap-agent-filter'), {
      target: { value: 'CLAUDE' },
    });
    expect(replaceMock).toHaveBeenCalledTimes(1);
    const url = replaceMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('heatmapAgent=CLAUDE');
    expect(url).toContain('heatmapPeriod=last12');
  });

  it('writes filter changes back to the URL when the period changes', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
    fireEvent.change(screen.getByTestId('activity-heatmap-period-filter'), {
      target: { value: '2024' },
    });
    const url = replaceMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('heatmapPeriod=2024');
  });

  it('disables the period selector when no prior years are available', () => {
    const data = makeHeatmapData({ availableYears: [] });
    renderWithProviders(<ActivityHeatmap initialData={data} />);
    expect(screen.getByTestId('activity-heatmap-period-filter')).toBeDisabled();
  });

  it('restores filters from URL search params', () => {
    mockSearchParams = new URLSearchParams('heatmapAgent=CLAUDE&heatmapPeriod=2024');
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);
    expect(screen.getByTestId('activity-heatmap-agent-filter')).toHaveValue('CLAUDE');
    expect(screen.getByTestId('activity-heatmap-period-filter')).toHaveValue('2024');
  });
});

import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ActivityHeatmap } from '@/components/projects/activity-heatmap';
import type { ActivityHeatmapData } from '@/lib/activity-heatmap/types';

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
      disabled,
      onValueChange,
      children,
    }: {
      value: string;
      disabled?: boolean;
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
              disabled,
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

function makeHeatmapData(overrides: Partial<ActivityHeatmapData> = {}): ActivityHeatmapData {
  return {
    period: {
      value: 'last-12m',
      label: 'Last 12 months',
      startDate: '2025-04-19',
      endDate: '2026-04-18',
    },
    periodOptions: [
      { value: 'last-12m', label: 'Last 12 months' },
      { value: '2026', label: '2026' },
      { value: '2025', label: '2025' },
    ],
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 5 },
      { value: 'CLAUDE', label: 'Claude', jobCount: 3 },
      { value: 'CODEX', label: 'Codex', jobCount: 2 },
    ],
    days: [
      {
        date: '2026-04-10',
        jobCount: 4,
        totalCost: 0.75,
        costIncomplete: false,
        shippedTickets: [
          { ticketKey: 'AIB-1', title: 'Ship me', projectKey: 'AIB' },
        ],
      },
      {
        date: '2026-04-12',
        jobCount: 1,
        totalCost: 0,
        costIncomplete: true,
        shippedTickets: [],
      },
    ],
    totals: { jobCount: 5, ticketsShipped: 1 },
    filters: { period: 'last-12m', agent: 'all' },
    generatedAt: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('ActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockSearchParams.forEach((_value, key) => mockSearchParams.delete(key));
    vi.restoreAllMocks();
  });

  it('renders totals counter with rolling-period copy', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    expect(screen.getByTestId('activity-heatmap-counter')).toHaveTextContent(
      /5 jobs · 1 ticket shipped in the last 12 months/
    );
  });

  it('renders totals counter with year-specific copy when period is a calendar year', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          period: {
            value: '2024',
            label: '2024',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
          },
          filters: { period: '2024', agent: 'all' },
          totals: { jobCount: 1, ticketsShipped: 2 },
        })}
      />
    );

    expect(screen.getByTestId('activity-heatmap-counter')).toHaveTextContent(
      /1 job · 2 tickets shipped in 2024/
    );
  });

  it('shows the empty-state message when there is no activity', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          days: [],
          totals: { jobCount: 0, ticketsShipped: 0 },
        })}
      />
    );

    expect(screen.getByTestId('activity-heatmap-empty')).toHaveTextContent(
      /No activity to show yet/
    );
    expect(screen.queryByTestId('activity-heatmap-cell')).not.toBeInTheDocument();
  });

  it('hides the agent filter when only 0-1 distinct agents are present', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          availableAgents: [
            { value: 'all', label: 'All agents', jobCount: 5 },
            { value: 'CLAUDE', label: 'Claude', jobCount: 5 },
          ],
        })}
      />
    );

    expect(screen.queryByTestId('activity-heatmap-agent-filter')).not.toBeInTheDocument();
  });

  it('renders the agent filter when multiple agents are available', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const agentSelect = screen.getByTestId('activity-heatmap-agent-filter');
    expect(agentSelect).toHaveValue('all');
    expect(screen.getByRole('option', { name: 'Claude' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Codex' })).toBeInTheDocument();
  });

  it('disables the period select when only the rolling option is available', () => {
    renderWithProviders(
      <ActivityHeatmap
        initialData={makeHeatmapData({
          periodOptions: [{ value: 'last-12m', label: 'Last 12 months' }],
        })}
      />
    );

    const periodSelect = screen.getByTestId('activity-heatmap-period-filter');
    expect(periodSelect).toBeDisabled();
  });

  it('updates URL query params when the agent filter changes', async () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    await act(async () => {
      const agentSelect = screen.getByTestId('activity-heatmap-agent-filter');
      fireEvent.change(agentSelect, { target: { value: 'CODEX' } });
    });

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('?heatmap-agent=CODEX', { scroll: false })
    );
  });

  it('updates URL query params with heatmap-period prefix when the period changes', async () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    await act(async () => {
      const periodSelect = screen.getByTestId('activity-heatmap-period-filter');
      fireEvent.change(periodSelect, { target: { value: '2025' } });
    });

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('?heatmap-period=2025', { scroll: false })
    );
  });

  it('omits the rolling period from the URL (default state)', async () => {
    mockSearchParams.set('heatmap-period', '2025');

    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    await act(async () => {
      const periodSelect = screen.getByTestId('activity-heatmap-period-filter');
      fireEvent.change(periodSelect, { target: { value: 'last-12m' } });
    });

    await waitFor(() => expect(pushMock).toHaveBeenCalled());
    // Rolling is the default, so heatmap-period must NOT leak into the URL
    const lastCall = pushMock.mock.calls.at(-1)?.[0] as string;
    expect(lastCall).not.toMatch(/heatmap-period/);
  });

  it('renders grid cells with intensity level derived from job count', () => {
    renderWithProviders(<ActivityHeatmap initialData={makeHeatmapData()} />);

    const activeDay = screen
      .getAllByTestId('activity-heatmap-cell')
      .find((el) => el.getAttribute('data-date') === '2026-04-10');
    expect(activeDay).toBeDefined();
    expect(activeDay).toHaveAttribute('data-job-count', '4');
    // 4 jobs -> intensity level 2 (1–2: 1, 3–5: 2)
    expect(activeDay).toHaveAttribute('data-level', '2');
  });
});

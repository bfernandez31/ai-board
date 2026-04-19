import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ProjectsActivityHeatmap } from '@/components/projects/projects-activity-heatmap';
import type { ProjectsActivityHeatmapData } from '@/lib/projects/activity-heatmap-types';

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
    disabled,
  }: {
    value?: string;
    options?: React.ReactNode[];
    onValueChange?: (value: string) => void;
    'data-testid'?: string;
    disabled?: boolean;
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
      onValueChange,
      children,
      disabled,
    }: {
      value: string;
      onValueChange: (value: string) => void;
      children: React.ReactNode;
      disabled?: boolean;
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
              disabled,
            });
          })}
        </>
      );
    },
    SelectTrigger,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    SelectItem,
  };
});

function makeInitialData(overrides: Partial<ProjectsActivityHeatmapData> = {}): ProjectsActivityHeatmapData {
  return {
    filters: {
      period: 'last-12-months',
      agent: 'all',
    },
    summary: {
      jobCount: 5,
      shippedTicketCount: 2,
      label: 'in the last year',
    },
    periodStart: '2025-04-19',
    periodEnd: '2026-04-19',
    userCreatedYear: 2024,
    availablePeriods: [
      { value: 'last-12-months', label: 'Last 12 months' },
      { value: '2026', label: '2026' },
      { value: '2025', label: '2025' },
      { value: '2024', label: '2024' },
    ],
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 5, isDefault: true },
      { value: 'CLAUDE', label: 'Claude', jobCount: 3, isDefault: false },
      { value: 'CODEX', label: 'Codex', jobCount: 2, isDefault: false },
    ],
    cells: [
      {
        date: '2026-04-10',
        jobCount: 3,
        shippedTicketCount: 1,
        totalCost: null,
        hasMissingCosts: true,
      },
      {
        date: '2026-04-11',
        jobCount: 2,
        shippedTicketCount: 1,
        totalCost: 4.5,
        hasMissingCosts: false,
      },
    ],
    hasAnyActivity: true,
    generatedAt: '2026-04-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectsActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockSearchParams.delete('period');
    mockSearchParams.delete('agent');
    vi.restoreAllMocks();
  });

  it('hydrates filters from the server payload and renders summary text', () => {
    renderWithProviders(<ProjectsActivityHeatmap initialData={makeInitialData()} />);

    expect(screen.getByText('5 jobs · 2 tickets shipped in the last year')).toBeInTheDocument();
    expect(screen.getByTestId('projects-heatmap-period-filter')).toHaveValue('last-12-months');
    expect(screen.getByTestId('projects-heatmap-agent-filter')).toHaveValue('all');
    expect(screen.getByRole('button', { name: /apr 10, 2026/i })).toBeInTheDocument();
  });

  it('hides the agent filter when there is nothing meaningful to filter', () => {
    renderWithProviders(
      <ProjectsActivityHeatmap
        initialData={makeInitialData({
          availableAgents: [{ value: 'all', label: 'All agents', jobCount: 5, isDefault: true }],
        })}
      />
    );

    expect(screen.queryByTestId('projects-heatmap-agent-filter')).not.toBeInTheDocument();
  });

  it('shows the empty-state message while keeping controls visible', () => {
    renderWithProviders(
      <ProjectsActivityHeatmap
        initialData={makeInitialData({
          summary: {
            jobCount: 0,
            shippedTicketCount: 0,
            label: 'in the last year',
          },
          cells: [],
          hasAnyActivity: false,
        })}
      />
    );

    expect(
      screen.getByText('No activity to show yet — your AI work will appear here')
    ).toBeInTheDocument();
    expect(screen.getByTestId('projects-heatmap-period-filter')).toBeInTheDocument();
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('pushes URL-backed filters when selections change', async () => {
    renderWithProviders(<ProjectsActivityHeatmap initialData={makeInitialData()} />);

    fireEvent.change(screen.getByTestId('projects-heatmap-period-filter'), {
      target: { value: '2026' },
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenLastCalledWith('?period=2026&agent=all', { scroll: false });
    });

    fireEvent.change(screen.getByTestId('projects-heatmap-agent-filter'), {
      target: { value: 'CODEX' },
    });

    await waitFor(() => {
      expect(pushMock).toHaveBeenLastCalledWith('?period=2026&agent=CODEX', { scroll: false });
    });
  });
});

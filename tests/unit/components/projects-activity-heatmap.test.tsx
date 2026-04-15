import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/tests/utils/component-test-utils';
import { ProjectsActivityHeatmap } from '@/components/projects/projects-activity-heatmap';
import type { ProjectsActivityResponse } from '@/lib/projects/activity';

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

            return React.cloneElement(child, {
              value,
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

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverAnchor: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeResponse(overrides: Partial<ProjectsActivityResponse> = {}): ProjectsActivityResponse {
  return {
    filters: {
      year: 'rolling',
      agent: 'all',
    },
    generatedAt: '2026-04-15T12:00:00.000Z',
    availableAgents: [
      { value: 'all', label: 'All agents' },
      { value: 'CODEX', label: 'Codex' },
      { value: 'CLAUDE', label: 'Claude' },
    ],
    periodOptions: [
      { value: 'rolling', label: 'Last 12 months' },
      { value: '2025', label: '2025' },
      { value: '2026', label: '2026' },
    ],
    summary: {
      totalJobs: 4,
      ticketsShipped: 2,
      periodLabel: 'Last 12 months',
    },
    heatmap: {
      hasActivity: true,
      firstDate: '2025-04-16',
      lastDate: '2026-04-15',
      totalWeeks: 2,
      weeks: [
        {
          monthLabel: 'Apr',
          days: [
            null,
            null,
            { date: '2026-04-13', dayOfWeek: 1, jobCount: 1, shippedTickets: 0, totalCostUsd: 1.25, intensity: 2 },
            { date: '2026-04-14', dayOfWeek: 2, jobCount: 0, shippedTickets: 0, totalCostUsd: 0, intensity: 0 },
            { date: '2026-04-15', dayOfWeek: 3, jobCount: 2, shippedTickets: 1, totalCostUsd: null, intensity: 4 },
            null,
            null,
          ],
        },
        {
          monthLabel: null,
          days: [null, null, null, null, null, null, null],
        },
      ],
    },
    ...overrides,
  };
}

describe('ProjectsActivityHeatmap', () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockSearchParams.delete('year');
    mockSearchParams.delete('agent');
  });

  it('updates the URL when filters change', () => {
    renderWithProviders(<ProjectsActivityHeatmap initialData={makeResponse()} />);

    fireEvent.change(screen.getByTestId('projects-activity-agent-filter'), {
      target: { value: 'CODEX' },
    });
    expect(pushMock).toHaveBeenCalledWith('?year=rolling&agent=CODEX', { scroll: false });

    fireEvent.change(screen.getByTestId('projects-activity-year-filter'), {
      target: { value: '2026' },
    });
    expect(pushMock).toHaveBeenLastCalledWith('?year=2026&agent=CODEX', { scroll: false });
  });

  it('shows the empty state message and hides unnecessary filters', () => {
    renderWithProviders(
      <ProjectsActivityHeatmap
        initialData={makeResponse({
          availableAgents: [{ value: 'all', label: 'All agents' }],
          periodOptions: [{ value: 'rolling', label: 'Last 12 months' }],
          summary: { totalJobs: 0, ticketsShipped: 0, periodLabel: 'Last 12 months' },
          heatmap: {
            hasActivity: false,
            firstDate: '2025-04-16',
            lastDate: '2026-04-15',
            totalWeeks: 2,
            weeks: [
              { monthLabel: 'Apr', days: [null, null, null, null, null, null, null] },
              { monthLabel: null, days: [null, null, null, null, null, null, null] },
            ],
          },
        })}
      />
    );

    expect(screen.queryByTestId('projects-activity-agent-filter')).not.toBeInTheDocument();
    expect(screen.getByTestId('projects-activity-year-filter')).toBeInTheDocument();
    expect(screen.getByText('Last 12 months only')).toBeInTheDocument();
    expect(
      screen.getByText('No activity to show yet — your AI work will appear here')
    ).toBeInTheDocument();
  });
});

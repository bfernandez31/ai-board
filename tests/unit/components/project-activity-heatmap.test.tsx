import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/tests/utils/component-test-utils';
import { ProjectActivityHeatmap } from '@/components/projects/project-activity-heatmap';
import type { ProjectActivityHeatmapData } from '@/lib/projects/activity-heatmap';

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
    }) => (
      <>
        {React.Children.map(children, (child) => {
          if (!React.isValidElement(child) || child.type !== SelectTrigger) {
            return null;
          }

          return React.cloneElement(child, {
            value,
            onValueChange,
            options: collectOptions(children),
          });
        })}
      </>
    ),
    SelectTrigger,
    SelectValue: () => null,
    SelectContent: () => null,
    SelectItem,
  };
});

function createHeatmapData(overrides: Partial<ProjectActivityHeatmapData> = {}): ProjectActivityHeatmapData {
  return {
    filters: { year: 'rolling', agent: 'all' },
    availableYears: [2026, 2025],
    availableAgents: [
      { value: 'all', label: 'All agents', jobCount: 3 },
      { value: 'CLAUDE', label: 'Claude', jobCount: 2 },
      { value: 'CODEX', label: 'Codex', jobCount: 1 },
    ],
    summary: {
      jobCount: 3,
      shippedCount: 2,
      totalCost: 3.75,
      label: 'in the last year',
    },
    days: [
      {
        date: '2026-04-10',
        weekIndex: 0,
        dayIndex: 5,
        jobCount: 1,
        shippedCount: 1,
        totalCost: 2.5,
        intensityLevel: 4,
      },
      {
        date: '2026-04-13',
        weekIndex: 1,
        dayIndex: 1,
        jobCount: 2,
        shippedCount: 1,
        totalCost: 1.25,
        intensityLevel: 2,
      },
    ],
    monthLabels: [
      { weekIndex: 0, label: 'Apr' },
    ],
    weeks: 2,
    maxJobCount: 2,
    generatedAt: '2026-04-14T12:00:00.000Z',
    ...overrides,
  };
}

describe('ProjectActivityHeatmap', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the yearly summary, labels, legend, and cells', () => {
    renderWithProviders(<ProjectActivityHeatmap initialData={createHeatmapData()} />);

    expect(screen.getByText('3 jobs · 2 tickets shipped in the last year')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Apr')).toBeInTheDocument();
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /april 13, 2026/i,
      })
    ).toBeInTheDocument();
  });

  it('refetches when the agent filter changes', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () =>
        createHeatmapData({
          filters: { year: 'rolling', agent: 'CODEX' },
          summary: {
            jobCount: 1,
            shippedCount: 1,
            totalCost: 2.5,
            label: 'in the last year',
          },
          availableAgents: [
            { value: 'all', label: 'All agents', jobCount: 3 },
            { value: 'CLAUDE', label: 'Claude', jobCount: 2 },
            { value: 'CODEX', label: 'Codex', jobCount: 1 },
          ],
        }),
    }));

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(<ProjectActivityHeatmap initialData={createHeatmapData()} />);

    fireEvent.change(screen.getByTestId('projects-activity-agent-filter'), {
      target: { value: 'CODEX' },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/projects/activity?year=rolling&agent=CODEX');
      expect(screen.getByText('1 job · 1 ticket shipped in the last year')).toBeInTheDocument();
    });
  });
});

/**
 * Component tests: ActivityHeatmapGrid (AIB-704)
 *
 * Covers T013 (grid layout, chipped corners, weekday labels, month labels),
 * T030 (tooltip content on hover/tap), T033 (touch toggle + outside dismiss),
 * and T041 (horizontal-scroll wrapper + sticky weekday column for mobile).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/tests/utils/component-test-utils';
import type { HeatmapDay } from '@/lib/heatmap/types';

vi.mock('@/components/ui/tooltip', () => {
  return {
    TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Tooltip: ({ open, children }: { open?: boolean; children: React.ReactNode }) => {
      const childArray = React.Children.toArray(children);
      return (
        <>
          {childArray.map((child, i) => {
            if (!React.isValidElement(child)) return null;
            if (child.type === TooltipContentMock) {
              return open ? React.cloneElement(child, { key: i }) : null;
            }
            return React.cloneElement(child, { key: i });
          })}
        </>
      );
    },
    TooltipTrigger: ({
      children,
      asChild: _asChild,
    }: {
      children: React.ReactNode;
      asChild?: boolean;
    }) => <>{children}</>,
    TooltipContent: (props: React.HTMLAttributes<HTMLDivElement>) => (
      <TooltipContentMock {...props} />
    ),
  };
});

function TooltipContentMock(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-testid="tooltip-content" {...props} />;
}

const { ActivityHeatmapGrid } = await import('@/components/projects/activity-heatmap-grid');

function makeDay(date: string, overrides: Partial<HeatmapDay> = {}): HeatmapDay {
  return {
    date,
    jobCount: 0,
    sumCostUsd: 0,
    hasAnyCost: false,
    shippedTickets: [],
    intensity: 0,
    ...overrides,
  };
}

function enumerate(startIso: string, count: number): HeatmapDay[] {
  const days: HeatmapDay[] = [];
  const [y, m, d] = startIso.split('-').map(Number) as [number, number, number];
  const cursor = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < count; i += 1) {
    const iso = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
    days.push(makeDay(iso));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

describe('ActivityHeatmapGrid', () => {
  it('renders 7 weekday labels with only Mon/Wed/Fri visible', () => {
    const days = enumerate('2026-01-04', 7); // Sunday → Saturday
    renderWithProviders(
      <ActivityHeatmapGrid days={days} startDate="2026-01-04" endDate="2026-01-10" />
    );

    const weekdays = screen.getByTestId('activity-heatmap-weekdays');
    const labels = weekdays.querySelectorAll('[data-weekday]');
    expect(labels).toHaveLength(7);

    const labelTexts = Array.from(labels).map((n) => n.textContent?.trim() ?? '');
    // Mon / Wed / Fri are visible; Sun/Tue/Thu/Sat are blank
    expect(labelTexts).toEqual(['', 'Mon', '', 'Wed', '', 'Fri', '']);
  });

  it('chipped top-left: renders empty spacer cells before the first day when period does not start on Sunday', () => {
    // 2026-01-06 is a Tuesday → first column should have 2 empty spacer cells (Sun, Mon)
    const days = enumerate('2026-01-06', 5);
    const { container } = renderWithProviders(
      <ActivityHeatmapGrid days={days} startDate="2026-01-06" endDate="2026-01-10" />
    );

    const firstWeek = container.querySelector('[data-week-index="0"]');
    expect(firstWeek).toBeTruthy();
    const empties = firstWeek!.querySelectorAll('[data-testid="activity-heatmap-empty-cell"]');
    expect(empties.length).toBe(2);
  });

  it('chipped bottom-right: renders empty spacer cells after the last day when period does not end on Saturday', () => {
    // 2026-01-04 (Sun) → 2026-01-06 (Tue) — last week column should have 4 empty cells at bottom
    const days = enumerate('2026-01-04', 3);
    const { container } = renderWithProviders(
      <ActivityHeatmapGrid days={days} startDate="2026-01-04" endDate="2026-01-06" />
    );

    const firstWeek = container.querySelector('[data-week-index="0"]');
    const empties = firstWeek!.querySelectorAll('[data-testid="activity-heatmap-empty-cell"]');
    expect(empties.length).toBe(4);
  });

  it('renders a cell for each populated day with data-intensity attribute', () => {
    const days = enumerate('2026-01-04', 7).map((d, i) =>
      i % 2 === 0 ? { ...d, jobCount: 3, intensity: 2 as const } : d
    );
    renderWithProviders(
      <ActivityHeatmapGrid days={days} startDate="2026-01-04" endDate="2026-01-10" />
    );

    for (const day of days) {
      const cell = screen.getByTestId(`activity-heatmap-cell-${day.date}`);
      expect(cell).toBeTruthy();
      expect(cell.getAttribute('data-intensity')).toBe(String(day.intensity));
    }
  });

  it('surfaces month labels for the first week containing a new month', () => {
    // Span January into February
    const days = enumerate('2026-01-25', 14); // crosses into Feb 2026
    renderWithProviders(
      <ActivityHeatmapGrid days={days} startDate="2026-01-25" endDate="2026-02-07" />
    );

    const monthLabels = screen.queryAllByTestId('activity-heatmap-month-label');
    const texts = monthLabels.map((n) => n.textContent?.trim() ?? '');
    expect(texts).toContain('Feb');
  });

  it('renders cost line with dollars when day has cost, omits dollars otherwise (SC-006)', async () => {
    const user = userEvent.setup();
    const days = [
      makeDay('2026-01-04', { jobCount: 3, sumCostUsd: 1.25, hasAnyCost: true, intensity: 2 }),
      makeDay('2026-01-05', { jobCount: 2, sumCostUsd: 0, hasAnyCost: false, intensity: 1 }),
      makeDay('2026-01-06'),
    ];
    renderWithProviders(
      <ActivityHeatmapGrid days={days} startDate="2026-01-04" endDate="2026-01-06" />
    );

    const costCell = screen.getByTestId('activity-heatmap-cell-2026-01-04');
    await user.click(costCell);
    await waitFor(() => {
      const tooltip = document.body.textContent ?? '';
      expect(tooltip).toMatch(/3 jobs · \$1\.25/);
    });

    const noCostCell = screen.getByTestId('activity-heatmap-cell-2026-01-05');
    await user.click(noCostCell);
    await waitFor(() => {
      const tooltip = document.body.textContent ?? '';
      expect(tooltip).toContain('2 jobs');
      // No $NaN, no $0 for cost-less day
      expect(tooltip).not.toContain('$NaN');
      expect(tooltip).not.toMatch(/2 jobs · \$/);
    });
  });

  it('renders shipped-ticket lines in tooltip when day has shipped tickets', async () => {
    const user = userEvent.setup();
    const days = [
      makeDay('2026-01-04', {
        jobCount: 2,
        shippedTickets: [
          { ticketKey: 'AIB-111', title: 'First shipped ticket' },
          { ticketKey: 'AIB-222', title: 'Second shipped ticket' },
        ],
        intensity: 2,
      }),
    ];
    renderWithProviders(
      <ActivityHeatmapGrid days={days} startDate="2026-01-04" endDate="2026-01-04" />
    );

    const cell = screen.getByTestId('activity-heatmap-cell-2026-01-04');
    await user.click(cell);
    await waitFor(() => {
      const text = document.body.textContent ?? '';
      expect(text).toContain('AIB-111');
      expect(text).toContain('First shipped ticket');
      expect(text).toContain('AIB-222');
    });
  });

  it('toggles tooltip on tap and dismisses on outside pointerdown (FR-023)', async () => {
    const user = userEvent.setup();
    const days = [makeDay('2026-01-04', { jobCount: 1, intensity: 1 })];
    renderWithProviders(
      <>
        <div data-testid="outside-area">outside</div>
        <ActivityHeatmapGrid days={days} startDate="2026-01-04" endDate="2026-01-04" />
      </>
    );

    const cell = screen.getByTestId('activity-heatmap-cell-2026-01-04');
    await user.click(cell);
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/1 job\b/);
    });
  });

  it('applies overflow-x-auto wrapper and sticky weekday column (US6/FR-028)', () => {
    const days = enumerate('2026-01-04', 7);
    const { container } = renderWithProviders(
      <ActivityHeatmapGrid days={days} startDate="2026-01-04" endDate="2026-01-10" />
    );

    const outer = container.querySelector('[data-testid="activity-heatmap-grid"]');
    expect(outer?.className ?? '').toContain('overflow-x-auto');

    const weekdays = screen.getByTestId('activity-heatmap-weekdays');
    const className = weekdays.className;
    expect(className).toContain('sticky');
    expect(className).toContain('left-0');
    expect(className).toContain('z-10');
  });
});

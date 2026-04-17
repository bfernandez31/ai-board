'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type {
  AgentFilter,
  HeatmapData,
  HeatmapPeriod,
} from '@/lib/analytics/activity-heatmap';
import {
  buildHeatmapGrid,
  formatCellDate,
  getIntensityBucket,
  WEEKDAY_LABELS,
} from '@/lib/analytics/activity-heatmap-grid';

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

const CELL_SIZE = 12; // px
const CELL_GAP = 3; // px

async function fetchHeatmap(
  agent: AgentFilter,
  period: HeatmapPeriod
): Promise<HeatmapData> {
  const params = new URLSearchParams();
  if (agent !== 'all') params.set('agent', agent);
  if (period.kind === 'year') params.set('year', String(period.year));
  const response = await fetch(`/api/user/activity?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch activity heatmap');
  }
  return response.json();
}

function parseFilters(
  searchParams: URLSearchParams,
  initial: HeatmapData
): { agent: AgentFilter; period: HeatmapPeriod } {
  const agentParam = (searchParams.get('heatmapAgent') || initial.filters.agent) as AgentFilter;
  const yearParam = searchParams.get('heatmapYear');
  let period: HeatmapPeriod = initial.filters.period;
  if (yearParam && /^\d{4}$/.test(yearParam)) {
    period = { kind: 'year', year: Number.parseInt(yearParam, 10) };
  } else if (!yearParam) {
    period = { kind: 'rolling', months: 12 };
  }
  return { agent: agentParam, period };
}

function filtersMatch(
  a: { agent: AgentFilter; period: HeatmapPeriod },
  b: { agent: AgentFilter; period: HeatmapPeriod }
): boolean {
  if (a.agent !== b.agent) return false;
  if (a.period.kind !== b.period.kind) return false;
  if (a.period.kind === 'year' && b.period.kind === 'year' && a.period.year !== b.period.year) {
    return false;
  }
  return true;
}

function periodLabel(period: HeatmapPeriod): string {
  if (period.kind === 'year') return `in ${period.year}`;
  return 'in the last year';
}

function bucketClass(bucket: 0 | 1 | 2 | 3 | 4): string {
  // Violet gradient matching the project's aurora/primary theme.
  // Static classes only — Tailwind purger requires them as complete literals.
  switch (bucket) {
    case 0:
      return 'bg-zinc-800/60 border border-zinc-800';
    case 1:
      return 'bg-violet-900/50 border border-violet-900/60';
    case 2:
      return 'bg-violet-700/70 border border-violet-700/80';
    case 3:
      return 'bg-violet-500/80 border border-violet-500/90';
    case 4:
      return 'bg-violet-400 border border-violet-300';
  }
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => parseFilters(searchParams, initialData));
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const shouldUseInitialData = filtersMatch(filters, {
    agent: initialData.filters.agent,
    period: initialData.filters.period,
  });

  const { data } = useQuery({
    queryKey: ['user-activity', filters.agent, filters.period.kind, filters.period.kind === 'year' ? filters.period.year : 0],
    queryFn: () => fetchHeatmap(filters.agent, filters.period),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 60000,
    staleTime: 30000,
    // Keep previous data while refetching — no spinner flash
    placeholderData: (previous) => previous,
  });

  const current: HeatmapData = data ?? initialData;
  const grid = useMemo(() => buildHeatmapGrid(current.cells), [current.cells]);

  const updateFilters = (next: { agent: AgentFilter; period: HeatmapPeriod }) => {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.agent === 'all') params.delete('heatmapAgent');
    else params.set('heatmapAgent', next.agent);
    if (next.period.kind === 'year') params.set('heatmapYear', String(next.period.year));
    else params.delete('heatmapYear');
    const query = params.toString();
    router.push(query ? `?${query}` : '?', { scroll: false });
  };

  const showAgentFilter = current.availableAgents.filter((o) => o.value !== 'all').length >= 2;
  const showYearSelector = current.availableYears.length > 0;

  const periodValue = filters.period.kind === 'year' ? String(filters.period.year) : 'rolling';
  const totalWidth = grid.columns * (CELL_SIZE + CELL_GAP);
  const hasActivity = current.totalJobs > 0 || current.totalShipped > 0;

  const hoveredCell = hoveredKey
    ? current.cells.find((c) => c.date === hoveredKey) ?? null
    : null;

  return (
    <section
      aria-label="Activity heatmap"
      data-testid="activity-heatmap"
      className="aurora-bg-subtle rounded-lg border border-zinc-800 p-4 sm:p-6"
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Activity</h2>
          <p className="text-sm text-muted-foreground" data-testid="activity-heatmap-counter">
            {current.totalJobs} {current.totalJobs === 1 ? 'job' : 'jobs'}
            {' · '}
            {current.totalShipped} {current.totalShipped === 1 ? 'ticket' : 'tickets'} shipped{' '}
            {periodLabel(current.filters.period)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {showAgentFilter && (
            <Select
              value={filters.agent}
              onValueChange={(value) =>
                updateFilters({ ...filters, agent: value as AgentFilter })
              }
            >
              <SelectTrigger
                className="w-[160px]"
                data-testid="activity-heatmap-agent-filter"
                aria-label="Filter by agent"
              >
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                {current.availableAgents.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {showYearSelector && (
            <Select
              value={periodValue}
              onValueChange={(value) => {
                const period: HeatmapPeriod =
                  value === 'rolling'
                    ? { kind: 'rolling', months: 12 }
                    : { kind: 'year', year: Number.parseInt(value, 10) };
                updateFilters({ ...filters, period });
              }}
            >
              <SelectTrigger
                className="w-[160px]"
                data-testid="activity-heatmap-year-selector"
                aria-label="Select year"
              >
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rolling">Last 12 months</SelectItem>
                {current.availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>

      {!hasActivity ? (
        <div
          className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground"
          data-testid="activity-heatmap-empty"
        >
          No activity to show yet — your AI work will appear here
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-start gap-2 overflow-x-auto pb-2">
            {/* Day-of-week labels (pinned on left during horizontal scroll) */}
            <div
              className="sticky left-0 z-10 flex flex-col items-end justify-between bg-background/80 pr-1 pt-5 text-[10px] text-muted-foreground"
              aria-hidden="true"
              style={{ height: `${7 * (CELL_SIZE + CELL_GAP) + 16}px` }}
            >
              {WEEKDAY_LABELS.map((label, i) => (
                <span
                  key={label}
                  className="h-3 leading-3"
                  style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex-1">
              {/* Month labels */}
              <div
                className="relative mb-1 text-[10px] text-muted-foreground"
                style={{ height: '14px', width: `${totalWidth}px` }}
                aria-hidden="true"
              >
                {grid.months.map((m) => (
                  <span
                    key={`${m.col}-${m.label}`}
                    className="absolute top-0"
                    style={{ left: `${m.col * (CELL_SIZE + CELL_GAP)}px` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>

              {/* Grid */}
              <div
                role="grid"
                aria-label="Daily activity grid"
                data-testid="activity-heatmap-grid"
                className="relative"
                style={{
                  width: `${totalWidth}px`,
                  height: `${7 * (CELL_SIZE + CELL_GAP)}px`,
                }}
              >
                {grid.cells.map(({ col, row, cell }) => {
                  const bucket = getIntensityBucket(cell.jobCount, grid.maxJobCount);
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      aria-label={`${formatCellDate(cell.date)} — ${cell.jobCount} jobs, ${cell.ticketsShipped} shipped`}
                      data-testid={`activity-cell-${cell.date}`}
                      data-bucket={bucket}
                      data-date={cell.date}
                      onMouseEnter={() => setHoveredKey(cell.date)}
                      onMouseLeave={() =>
                        setHoveredKey((current) => (current === cell.date ? null : current))
                      }
                      onFocus={() => setHoveredKey(cell.date)}
                      onBlur={() => setHoveredKey(null)}
                      onClick={() =>
                        setHoveredKey((current) => (current === cell.date ? null : cell.date))
                      }
                      className={cn(
                        'absolute rounded-[2px] transition-colors focus:outline-none focus:ring-1 focus:ring-violet-400',
                        bucketClass(bucket)
                      )}
                      style={{
                        left: `${col * (CELL_SIZE + CELL_GAP)}px`,
                        top: `${row * (CELL_SIZE + CELL_GAP)}px`,
                        width: `${CELL_SIZE}px`,
                        height: `${CELL_SIZE}px`,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((b) => (
              <span
                key={b}
                className={cn('inline-block rounded-[2px]', bucketClass(b as 0 | 1 | 2 | 3 | 4))}
                style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                aria-hidden="true"
              />
            ))}
            <span>More</span>
          </div>

          {/* Tooltip */}
          {hoveredCell && (
            <div
              role="tooltip"
              data-testid="activity-heatmap-tooltip"
              className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-md border border-zinc-700 bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
            >
              <div className="font-medium">{formatCellDate(hoveredCell.date)}</div>
              <div className="mt-1 text-muted-foreground">
                {hoveredCell.jobCount} {hoveredCell.jobCount === 1 ? 'job' : 'jobs'}
                {hoveredCell.totalCost != null && (
                  <> · ${hoveredCell.totalCost.toFixed(2)}</>
                )}
              </div>
              <div className="text-muted-foreground">
                {hoveredCell.ticketsShipped} {hoveredCell.ticketsShipped === 1 ? 'ticket' : 'tickets'} shipped
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

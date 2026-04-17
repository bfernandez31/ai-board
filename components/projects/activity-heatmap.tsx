'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  buildGrid,
  formatHeatmapDate,
  getIntensityBucket,
  resolvePeriod,
} from '@/lib/activity-heatmap/period';
import type {
  HeatmapData,
  HeatmapDay,
  HeatmapFilters,
} from '@/lib/activity-heatmap/types';
import type { AgentFilter } from '@/lib/analytics/types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
// Match GitHub: only every other day-of-week label is rendered.
const VISIBLE_DAY_LABEL_INDICES = new Set([1, 3, 5]);

const INTENSITY_BG_BY_BUCKET: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[hsl(var(--ctp-mauve)/0.06)] border border-[hsl(var(--ctp-mauve)/0.10)]',
  1: 'bg-[hsl(var(--primary-violet)/0.18)] border border-[hsl(var(--primary-violet)/0.20)]',
  2: 'bg-[hsl(var(--primary-violet)/0.40)] border border-[hsl(var(--primary-violet)/0.30)]',
  3: 'bg-[hsl(var(--primary-violet)/0.65)] border border-[hsl(var(--primary-violet)/0.45)]',
  4: 'bg-[hsl(var(--primary-violet)/0.95)] border border-[hsl(var(--primary-violet)/0.70)]',
};

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams({
    period: filters.period,
    agent: filters.agent,
  });
  const response = await fetch(`/api/activity-heatmap?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch activity heatmap');
  }
  return response.json();
}

function getInitialFilters(
  searchParams: URLSearchParams,
  initialData: HeatmapData
): HeatmapFilters {
  const period = searchParams.get('hm-period') ?? initialData.filters.period;
  const agentParam = searchParams.get('hm-agent');
  const agent = (agentParam as AgentFilter | null) ?? initialData.filters.agent;
  return { period, agent };
}

function filtersMatch(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.period === b.period && a.agent === b.agent;
}

function formatCost(cost: number): string {
  if (cost >= 1000) return `$${(cost / 1000).toFixed(1)}k`;
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  return `$${cost.toFixed(2)}`;
}

interface HeatmapCellProps {
  day: HeatmapDay | null;
  bucket: 0 | 1 | 2 | 3 | 4;
}

function HeatmapCell({ day, bucket }: HeatmapCellProps) {
  const className = `aspect-square w-full rounded-sm transition-colors ${INTENSITY_BG_BY_BUCKET[bucket]}`;

  if (!day) {
    return <div className={className} />;
  }

  const dateLabel = formatHeatmapDate(day.date);
  const tooltipBody = (
    <div className="space-y-0.5 text-left">
      <p className="text-xs font-medium">{dateLabel}</p>
      <p className="text-xs">
        {day.jobCount === 0
          ? 'No activity'
          : `${day.jobCount} job${day.jobCount === 1 ? '' : 's'}`}
        {day.totalCost != null && day.totalCost > 0 && (
          <span> · {formatCost(day.totalCost)}</span>
        )}
      </p>
      {day.ticketsShipped > 0 && (
        <p className="text-xs">
          {day.ticketsShipped} ticket{day.ticketsShipped === 1 ? '' : 's'} shipped
        </p>
      )}
    </div>
  );

  // Desktop hover tooltip + mobile tap popover. Both wrap the same cell.
  return (
    <>
      <div className="hidden sm:block">
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${dateLabel}: ${day.jobCount} jobs, ${day.ticketsShipped} shipped`}
              className={className}
              data-testid="heatmap-cell"
              data-date={day.date}
              data-job-count={day.jobCount}
            />
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border">
            {tooltipBody}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="sm:hidden">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${dateLabel}: ${day.jobCount} jobs, ${day.ticketsShipped} shipped`}
              className={className}
              data-testid="heatmap-cell"
              data-date={day.date}
              data-job-count={day.jobCount}
            />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">{tooltipBody}</PopoverContent>
        </Popover>
      </div>
    </>
  );
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(new URLSearchParams(searchParams.toString()), initialData)
  );

  const shouldUseInitialData = filtersMatch(filters, initialData.filters);

  const { data } = useQuery({
    queryKey: queryKeys.activityHeatmap.data(filters.period, filters.agent),
    queryFn: () => fetchHeatmap(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const heatmap = data ?? initialData;

  // The grid is derived from the *displayed* period — when filters change
  // and the new request is in flight we still render the previous grid.
  const grid = useMemo(() => buildGrid(heatmap.period), [heatmap.period]);
  const dayByDate = useMemo(() => {
    const map = new Map<string, HeatmapDay>();
    for (const d of heatmap.days) map.set(d.date, d);
    return map;
  }, [heatmap.days]);

  const maxJobCount = useMemo(
    () => heatmap.days.reduce((max, d) => Math.max(max, d.jobCount), 0),
    [heatmap.days]
  );

  const updateFilters = (next: HeatmapFilters) => {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.period === 'last-12-months') {
      params.delete('hm-period');
    } else {
      params.set('hm-period', next.period);
    }
    if (next.agent === 'all') {
      params.delete('hm-agent');
    } else {
      params.set('hm-agent', next.agent);
    }
    const query = params.toString();
    router.push(query ? `?${query}` : '?', { scroll: false });
  };

  const showAgentFilter = heatmap.availableAgents.length > 2;
  const showYearSelector = heatmap.availableYears.length > 0;
  const hasAnyActivity = heatmap.totals.jobs > 0;

  return (
    <section
      aria-labelledby="activity-heatmap-heading"
      className="aurora-bg-card-mauve rounded-lg border border-[hsl(var(--ctp-mauve)/0.15)] p-4 sm:p-6"
      data-testid="activity-heatmap"
    >
      <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="activity-heatmap-heading"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Activity
          </h2>
          <p className="mt-1 text-base text-foreground" data-testid="heatmap-counter">
            {heatmap.totals.jobs.toLocaleString()} job
            {heatmap.totals.jobs === 1 ? '' : 's'} ·{' '}
            {heatmap.totals.ticketsShipped.toLocaleString()} ticket
            {heatmap.totals.ticketsShipped === 1 ? '' : 's'} shipped in{' '}
            {heatmap.period.kind === 'rolling'
              ? 'the last year'
              : heatmap.period.label}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showAgentFilter && (
            <Select
              value={filters.agent}
              onValueChange={(value) =>
                updateFilters({ ...filters, agent: value as AgentFilter })
              }
            >
              <SelectTrigger
                className="w-[160px]"
                data-testid="heatmap-agent-filter"
              >
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                {heatmap.availableAgents.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showYearSelector && (
            <Select
              value={filters.period}
              onValueChange={(value) =>
                updateFilters({ ...filters, period: value })
              }
            >
              <SelectTrigger
                className="w-[170px]"
                data-testid="heatmap-period-selector"
              >
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last-12-months">Last 12 months</SelectItem>
                {heatmap.availableYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </header>

      <TooltipProvider>
        <div className="overflow-x-auto pb-2">
          {hasAnyActivity ? (
            <div className="flex min-w-fit gap-1">
              {/* Day-of-week labels — pinned on the left during horizontal scroll */}
              <div className="sticky left-0 z-10 mt-5 flex flex-col gap-1 bg-[hsl(var(--ctp-mauve)/0.04)] pr-2 text-[10px] text-muted-foreground">
                {DAY_LABELS.map((label, idx) => (
                  <div
                    key={label}
                    className="flex h-3 items-center sm:h-3.5"
                    style={{ minWidth: '1.75rem' }}
                  >
                    {VISIBLE_DAY_LABEL_INDICES.has(idx) ? label : ''}
                  </div>
                ))}
              </div>

              <div>
                <div
                  className="grid h-5 text-[10px] text-muted-foreground"
                  style={{
                    gridTemplateColumns: `repeat(${grid.weekCount}, minmax(0.75rem, 1fr))`,
                  }}
                >
                  {grid.monthLabels.map((label, i) => (
                    <div key={i} className="truncate">
                      {label}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1">
                  {grid.rows.map((row, dayIdx) => (
                    <div
                      key={dayIdx}
                      className="grid gap-1"
                      style={{
                        gridTemplateColumns: `repeat(${grid.weekCount}, minmax(0.75rem, 1fr))`,
                      }}
                    >
                      {row.map((cell, weekIdx) => {
                        if (!cell.inPeriod || !cell.date) {
                          return <div key={weekIdx} className="aspect-square" />;
                        }
                        const day = dayByDate.get(cell.date) ?? {
                          date: cell.date,
                          jobCount: 0,
                          totalCost: null,
                          ticketsShipped: 0,
                        };
                        const bucket = getIntensityBucket(day.jobCount, maxJobCount);
                        return (
                          <HeatmapCell key={weekIdx} day={day} bucket={bucket} />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-[hsl(var(--ctp-mauve)/0.2)] p-6 text-center text-sm text-muted-foreground"
              data-testid="heatmap-empty-state"
            >
              No activity to show yet — your AI work will appear here
            </div>
          )}
        </div>
      </TooltipProvider>

      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((bucket) => (
          <span
            key={bucket}
            className={`h-3 w-3 rounded-sm ${INTENSITY_BG_BY_BUCKET[bucket]}`}
            aria-hidden="true"
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

/** Convenience helper for tests / callers that want defaults. */
export function buildDefaultHeatmapFilters(): HeatmapFilters {
  return { period: 'last-12-months', agent: 'all' };
}

// Re-export so callers can detect period parsing without importing from
// the deeper module path.
export { resolvePeriod };

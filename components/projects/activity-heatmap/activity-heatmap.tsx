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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  isValidAgentFilter,
  parsePeriodFilter,
} from '@/lib/heatmap/aggregations';
import { buildGridLayout, formatTooltipDate } from '@/lib/heatmap/grid';
import type {
  HeatmapAgentFilter,
  HeatmapData,
  HeatmapDay,
  HeatmapFilters,
  HeatmapPeriod,
} from '@/lib/heatmap/types';

const DAY_LABEL_ROWS: Array<{ label: string; visible: boolean }> = [
  { label: 'Sun', visible: false },
  { label: 'Mon', visible: true },
  { label: 'Tue', visible: false },
  { label: 'Wed', visible: true },
  { label: 'Thu', visible: false },
  { label: 'Fri', visible: true },
  { label: 'Sat', visible: false },
];

const HEATMAP_QUERY_KEY = 'activity-heatmap';

function buildQueryString(filters: HeatmapFilters): string {
  const params = new URLSearchParams();
  params.set('period', filters.period === 'last12' ? 'last12' : String(filters.period));
  params.set('agent', filters.agent);
  return params.toString();
}

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const response = await fetch(`/api/activity-heatmap?${buildQueryString(filters)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch activity heatmap');
  }
  return response.json();
}

function filtersMatch(left: HeatmapFilters, right: HeatmapFilters): boolean {
  return left.period === right.period && left.agent === right.agent;
}

export const HEATMAP_PERIOD_PARAM = 'heatmapPeriod';
export const HEATMAP_AGENT_PARAM = 'heatmapAgent';

function getInitialFilters(
  searchParams: URLSearchParams,
  initialData: HeatmapData
): HeatmapFilters {
  const parsedPeriod = parsePeriodFilter(searchParams.get(HEATMAP_PERIOD_PARAM));
  let period: HeatmapPeriod = initialData.filters.period;
  if (parsedPeriod === 'last12') {
    period = 'last12';
  } else if (parsedPeriod !== null && initialData.availableYears.includes(parsedPeriod)) {
    period = parsedPeriod;
  }

  const rawAgent = searchParams.get(HEATMAP_AGENT_PARAM);
  const isKnownAgent =
    rawAgent !== null &&
    isValidAgentFilter(rawAgent) &&
    initialData.availableAgents.some((option) => option.value === rawAgent);
  const agent: HeatmapAgentFilter = isKnownAgent ? rawAgent : initialData.filters.agent;

  return { period, agent };
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function buildShippedLabel(count: number): string {
  return `${count} ticket${count === 1 ? '' : 's'} shipped`;
}

function buildJobsLabel(count: number): string {
  return `${count} job${count === 1 ? '' : 's'}`;
}

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(searchParams, initialData)
  );
  const [openCellKey, setOpenCellKey] = useState<string | null>(null);

  const shouldUseInitialData = filtersMatch(filters, initialData.filters);

  const { data } = useQuery({
    queryKey: [
      HEATMAP_QUERY_KEY,
      filters.period === 'last12' ? 'last12' : String(filters.period),
      filters.agent,
    ],
    queryFn: () => fetchHeatmap(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const heatmap = data ?? initialData;
  const layout = useMemo(
    () => buildGridLayout(heatmap.startDate, heatmap.endDate, heatmap.days),
    [heatmap.startDate, heatmap.endDate, heatmap.days]
  );

  const updateFilters = (next: HeatmapFilters) => {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set(HEATMAP_PERIOD_PARAM, next.period === 'last12' ? 'last12' : String(next.period));
    params.set(HEATMAP_AGENT_PARAM, next.agent);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const hasActivity = heatmap.totals.jobCount > 0 || heatmap.totals.ticketsShipped > 0;
  const showAgentFilter = heatmap.availableAgents.length > 2; // "all" + at least 2 agents
  const showYearSelector = heatmap.availableYears.length > 0;
  const periodLabel = buildPeriodLabel(filters.period);

  return (
    <section
      className="mt-10 rounded-lg border border-border bg-card/50 p-4 sm:p-6"
      data-testid="activity-heatmap"
      aria-label="Activity heatmap"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Activity</h2>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="activity-heatmap-counter">
            {heatmap.totals.jobCount} jobs · {heatmap.totals.ticketsShipped} tickets shipped in {periodLabel}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {showAgentFilter && (
            <Select
              value={filters.agent}
              onValueChange={(value) =>
                isValidAgentFilter(value) &&
                updateFilters({ ...filters, agent: value })
              }
            >
              <SelectTrigger
                className="w-full sm:w-[160px]"
                data-testid="activity-heatmap-agent-filter"
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

          <Select
            value={filters.period === 'last12' ? 'last12' : String(filters.period)}
            onValueChange={(value) => {
              if (value === 'last12') {
                updateFilters({ ...filters, period: 'last12' });
                return;
              }
              const year = Number(value);
              if (Number.isFinite(year)) {
                updateFilters({ ...filters, period: year });
              }
            }}
            disabled={!showYearSelector}
          >
            <SelectTrigger
              className="w-full sm:w-[180px]"
              data-testid="activity-heatmap-period-filter"
            >
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last12">Last 12 months</SelectItem>
              {heatmap.availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4">
        {hasActivity ? (
          <div className="flex overflow-x-auto" data-testid="activity-heatmap-grid">
            <div
              className="sticky left-0 z-10 mr-2 flex shrink-0 flex-col justify-between bg-card/50 py-5 text-[10px] text-muted-foreground"
              aria-hidden="true"
            >
              {DAY_LABEL_ROWS.map((row, index) => (
                <div key={index} className="h-3 leading-3">
                  {row.visible ? row.label : ''}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1 pr-2">
              <div className="flex h-4 gap-1 text-[10px] text-muted-foreground">
                {layout.columns.map((column) => (
                  <div key={column.key} className="w-3 shrink-0">
                    {column.monthLabel}
                  </div>
                ))}
              </div>

              <div className="flex gap-1" role="grid">
                {layout.columns.map((column) => (
                  <div key={column.key} className="flex w-3 shrink-0 flex-col gap-1" role="row">
                    {column.cells.map((cell, rowIndex) => {
                      if (cell.date === null) {
                        return <div key={rowIndex} className="h-3 w-3" aria-hidden="true" />;
                      }
                      const cellKey = `${column.key}-${rowIndex}`;
                      const isOpen = openCellKey === cellKey;
                      return (
                        <Popover
                          key={rowIndex}
                          open={isOpen}
                          onOpenChange={(open) => setOpenCellKey(open ? cellKey : null)}
                        >
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className={`h-3 w-3 rounded-sm transition-colors hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary activity-heatmap-cell-${cell.level ?? 0}`}
                              aria-label={buildCellLabel(cell.date, cell.day)}
                              data-testid="activity-heatmap-cell"
                              data-level={cell.level ?? 0}
                              data-date={cell.date}
                              onMouseEnter={() => setOpenCellKey(cellKey)}
                              onMouseLeave={() =>
                                setOpenCellKey((current) => (current === cellKey ? null : current))
                              }
                              onFocus={() => setOpenCellKey(cellKey)}
                            />
                          </PopoverTrigger>
                          <PopoverContent
                            className="aurora-bg-dialog w-auto min-w-[200px] border-border p-3 text-xs"
                            side="top"
                            onOpenAutoFocus={(event) => event.preventDefault()}
                          >
                            <HeatmapCellTooltip date={cell.date} day={cell.day} />
                          </PopoverContent>
                        </Popover>
                      );
                    })}
                  </div>
                ))}
              </div>

              <HeatmapLegend />
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-background/40 py-12 text-sm text-muted-foreground"
            data-testid="activity-heatmap-empty"
          >
            No activity to show yet — your AI work will appear here
            <div className="mt-6 w-full max-w-xs">
              <HeatmapLegend />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HeatmapLegend() {
  return (
    <div
      className="ml-auto mt-2 flex items-center gap-1 text-[10px] text-muted-foreground"
      data-testid="activity-heatmap-legend"
    >
      <span>Less</span>
      {[0, 1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className={`h-3 w-3 rounded-sm activity-heatmap-cell-${level}`}
          aria-hidden="true"
        />
      ))}
      <span>More</span>
    </div>
  );
}

function HeatmapCellTooltip({ date, day }: { date: string; day: HeatmapDay | null }) {
  const jobCount = day?.jobCount ?? 0;
  const shipped = day?.shipped ?? 0;
  const totalCost = day?.totalCost ?? null;
  const hasActivity = jobCount > 0 || shipped > 0;

  return (
    <div className="space-y-1" data-testid="activity-heatmap-tooltip">
      <div className="font-medium text-foreground">{formatTooltipDate(date)}</div>
      {hasActivity ? (
        <>
          {shipped > 0 && (
            <div className="text-muted-foreground">{buildShippedLabel(shipped)}</div>
          )}
          <div className="text-muted-foreground">{buildJobsLabel(jobCount)}</div>
          {totalCost !== null && jobCount > 0 && (
            <div className="text-muted-foreground">Total cost: {formatCost(totalCost)}</div>
          )}
        </>
      ) : (
        <div className="text-muted-foreground">No activity</div>
      )}
    </div>
  );
}

function buildCellLabel(date: string, day: HeatmapDay | null): string {
  const jobCount = day?.jobCount ?? 0;
  const shipped = day?.shipped ?? 0;
  const parts = [formatTooltipDate(date), `${jobCount} jobs`];
  if (shipped > 0) parts.push(`${shipped} shipped`);
  return parts.join(', ');
}

function buildPeriodLabel(period: HeatmapPeriod): string {
  if (period === 'last12') return 'the last 12 months';
  return String(period);
}

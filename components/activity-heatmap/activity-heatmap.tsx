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
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  buildHeatmapGrid,
  computeIntensityThresholds,
  formatLongDate,
  getIntensityClass,
  getIntensityLevel,
  isValidPeriod,
  resolvePeriod,
} from '@/lib/activity-heatmap/aggregations';
import type {
  HeatmapAgentFilter,
  HeatmapData,
  HeatmapFilters,
  HeatmapPeriod,
} from '@/lib/activity-heatmap/types';

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

async function fetchActivityHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams({
    period: filters.period,
    agent: filters.agent,
  });
  const response = await fetch(`/api/user/activity-heatmap?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch activity heatmap');
  }
  return response.json();
}

function filtersMatch(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.period === b.period && a.agent === b.agent;
}

function getInitialFilters(
  searchParams: URLSearchParams,
  initialData: HeatmapData
): HeatmapFilters {
  const rawPeriod = searchParams.get('heatmapPeriod');
  const rawAgent = searchParams.get('heatmapAgent') as HeatmapAgentFilter | null;
  const period: HeatmapPeriod =
    rawPeriod && isValidPeriod(rawPeriod) ? rawPeriod : initialData.filters.period;
  const agentIsValid =
    rawAgent != null &&
    initialData.availableAgents.some((option) => option.value === rawAgent);
  const agent: HeatmapAgentFilter = agentIsValid ? rawAgent : initialData.filters.agent;
  return { period, agent };
}

function buildHeatmapSearchParams(
  searchParams: URLSearchParams,
  filters: HeatmapFilters
): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  next.set('heatmapPeriod', filters.period);
  next.set('heatmapAgent', filters.agent);
  return next;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VISIBLE_DAY_LABEL_ROWS = new Set([1, 3, 5]);

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(searchParams, initialData)
  );

  const shouldUseInitialData = filtersMatch(filters, initialData.filters);

  const { data } = useQuery({
    queryKey: queryKeys.activityHeatmap.data(filters.period, filters.agent),
    queryFn: () => fetchActivityHeatmap(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const workingData = data ?? initialData;

  const updateFilters = (next: HeatmapFilters) => {
    setFilters(next);
    const params = buildHeatmapSearchParams(searchParams, next);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const grid = useMemo(() => {
    const period = resolvePeriod(workingData.filters.period, new Date(workingData.generatedAt));
    return buildHeatmapGrid(period.start, period.end, workingData.days);
  }, [workingData]);

  const thresholds = useMemo(
    () => computeIntensityThresholds(workingData.days),
    [workingData.days]
  );

  const dayDataMap = useMemo(
    () => new Map(workingData.days.map((day) => [day.date, day])),
    [workingData.days]
  );

  const showAgentFilter = workingData.availableAgents.length > 2;
  const showPeriodSelector = workingData.availablePeriods.length > 1;
  const hasActivity = workingData.totalJobs > 0;

  const counterText = `${workingData.totalJobs.toLocaleString()} ${
    workingData.totalJobs === 1 ? 'job' : 'jobs'
  } · ${workingData.totalTicketsShipped.toLocaleString()} ${
    workingData.totalTicketsShipped === 1 ? 'ticket' : 'tickets'
  } shipped in ${workingData.filters.period === 'last-12-months' ? 'the last year' : workingData.filters.period}`;

  return (
    <section
      data-testid="activity-heatmap"
      className="rounded-lg border bg-card p-4 sm:p-6"
      aria-label="Activity heatmap"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-foreground">{counterText}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {showAgentFilter && (
            <Select
              value={filters.agent}
              onValueChange={(value) =>
                updateFilters({ ...filters, agent: value as HeatmapAgentFilter })
              }
            >
              <SelectTrigger
                className="w-full sm:w-[160px]"
                data-testid="heatmap-agent-filter"
              >
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                {workingData.availableAgents.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showPeriodSelector && (
            <Select
              value={filters.period}
              onValueChange={(value) => updateFilters({ ...filters, period: value })}
            >
              <SelectTrigger
                className="w-full sm:w-[180px]"
                data-testid="heatmap-period-filter"
              >
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {workingData.availablePeriods.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="mt-4">
        {hasActivity ? (
          <HeatmapGridView
            grid={grid}
            dayDataMap={dayDataMap}
            thresholds={thresholds}
          />
        ) : (
          <HeatmapEmptyState />
        )}

        <HeatmapLegend />
      </div>
    </section>
  );
}

function HeatmapEmptyState() {
  return (
    <div
      data-testid="heatmap-empty-state"
      className="flex items-center justify-center rounded-md border border-dashed py-16 text-center text-sm text-muted-foreground"
    >
      No activity to show yet — your AI work will appear here
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div
      data-testid="heatmap-legend"
      className="mt-3 flex items-center justify-end gap-1.5 text-xs text-muted-foreground"
    >
      <span>Less</span>
      <div className="h-3 w-3 rounded-sm aurora-heatmap-cell-0" />
      <div className="h-3 w-3 rounded-sm aurora-heatmap-cell-1" />
      <div className="h-3 w-3 rounded-sm aurora-heatmap-cell-2" />
      <div className="h-3 w-3 rounded-sm aurora-heatmap-cell-3" />
      <div className="h-3 w-3 rounded-sm aurora-heatmap-cell-4" />
      <span>More</span>
    </div>
  );
}

interface HeatmapGridViewProps {
  grid: ReturnType<typeof buildHeatmapGrid>;
  dayDataMap: Map<string, import('@/lib/activity-heatmap/types').HeatmapDay>;
  thresholds: ReturnType<typeof computeIntensityThresholds>;
}

function HeatmapGridView({ grid, dayDataMap, thresholds }: HeatmapGridViewProps) {
  const cellSize = 'h-3.5 w-3.5 sm:h-4 sm:w-4';

  return (
    <div className="relative overflow-x-auto">
      <div className="inline-flex min-w-max flex-col gap-1">
        <div
          className="flex gap-1 pl-10"
          data-testid="heatmap-month-labels"
          aria-hidden="true"
        >
          {Array.from({ length: grid.weekCount }, (_, weekIndex) => {
            const label = grid.monthLabels.find((m) => m.weekIndex === weekIndex);
            return (
              <div
                key={weekIndex}
                className={`${cellSize} text-[10px] leading-3 text-muted-foreground`}
              >
                {label?.label ?? ''}
              </div>
            );
          })}
        </div>

        <div className="flex">
          <div
            className="sticky left-0 z-10 mr-1 flex flex-col gap-1 bg-card pr-1"
            aria-hidden="true"
          >
            {DAY_LABELS.map((dayLabel, rowIndex) => (
              <div
                key={dayLabel}
                className={`${cellSize} flex items-center text-[10px] leading-3 text-muted-foreground`}
              >
                {VISIBLE_DAY_LABEL_ROWS.has(rowIndex) ? dayLabel : ''}
              </div>
            ))}
          </div>

          <div
            role="grid"
            aria-label="Daily activity grid"
            className="flex flex-col gap-1"
          >
            {grid.rows.map((row, rowIndex) => (
              <div key={rowIndex} role="row" className="flex gap-1">
                {row.map((cell) => {
                  if (!cell.inPeriod) {
                    return (
                      <div
                        key={cell.date}
                        role="gridcell"
                        aria-hidden="true"
                        className={`${cellSize} opacity-0`}
                      />
                    );
                  }
                  const dayData = dayDataMap.get(cell.date);
                  const count = dayData?.jobCount ?? 0;
                  const level = getIntensityLevel(count, thresholds);
                  const intensityClass = getIntensityClass(level);
                  return (
                    <HeatmapCell
                      key={cell.date}
                      date={cell.date}
                      jobCount={count}
                      totalCost={dayData?.totalCost ?? null}
                      ticketsShipped={dayData?.ticketsShipped ?? 0}
                      intensityClass={intensityClass}
                      cellSize={cellSize}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface HeatmapCellProps {
  date: string;
  jobCount: number;
  totalCost: number | null;
  ticketsShipped: number;
  intensityClass: string;
  cellSize: string;
}

function HeatmapCell({
  date,
  jobCount,
  totalCost,
  ticketsShipped,
  intensityClass,
  cellSize,
}: HeatmapCellProps) {
  const summaryLabel = `${formatLongDate(date)}: ${jobCount} ${
    jobCount === 1 ? 'job' : 'jobs'
  }${ticketsShipped > 0 ? `, ${ticketsShipped} shipped` : ''}`;

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="heatmap-cell"
          data-date={date}
          data-count={jobCount}
          aria-label={summaryLabel}
          className={`${cellSize} rounded-sm transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-card focus:ring-primary ${intensityClass}`}
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs px-3 py-2">
        <HeatmapTooltipBody
          date={date}
          jobCount={jobCount}
          totalCost={totalCost}
          ticketsShipped={ticketsShipped}
        />
      </TooltipContent>
    </Tooltip>
  );
}

interface HeatmapTooltipBodyProps {
  date: string;
  jobCount: number;
  totalCost: number | null;
  ticketsShipped: number;
}

function HeatmapTooltipBody({
  date,
  jobCount,
  totalCost,
  ticketsShipped,
}: HeatmapTooltipBodyProps) {
  return (
    <div className="space-y-0.5 text-xs">
      <div className="font-medium">{formatLongDate(date)}</div>
      <div>
        {jobCount} {jobCount === 1 ? 'job' : 'jobs'}
        {totalCost != null && (
          <span className="ml-1 text-muted-foreground">· ${totalCost.toFixed(2)}</span>
        )}
      </div>
      {ticketsShipped > 0 && (
        <div>
          {ticketsShipped} {ticketsShipped === 1 ? 'ticket' : 'tickets'} shipped
        </div>
      )}
    </div>
  );
}

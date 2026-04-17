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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { queryKeys } from '@/app/lib/query-keys';
import { cn } from '@/lib/utils';
import {
  buildHeatmapGrid,
  formatTooltipDate,
  getIntensityLevel,
  getMaxJobCount,
  getPeriodLabel,
  isValidPeriod,
  parseIsoDate,
} from '@/lib/activity-heatmap/aggregations';
import { ALL_AGENTS } from '@/app/lib/utils/agent-resolution';
import type {
  HeatmapAgentFilter,
  HeatmapData,
  HeatmapFilters,
  HeatmapPeriod,
} from '@/lib/activity-heatmap/types';

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
// Only show Mon, Wed, Fri (GitHub style)
const VISIBLE_DAY_ROWS = new Set([1, 3, 5]);

const INTENSITY_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-muted/30 border border-border/40',
  1: 'bg-violet-500/20 border border-violet-500/30',
  2: 'bg-violet-500/40 border border-violet-500/50',
  3: 'bg-violet-500/65 border border-violet-500/70',
  4: 'bg-violet-500/90 border border-violet-500',
};

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams();
  params.set('period', filters.period);
  params.set('agent', filters.agent);
  const res = await fetch(`/api/activity-heatmap?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch activity heatmap');
  }
  return res.json();
}

function filtersMatch(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.period === b.period && a.agent === b.agent;
}

function getInitialFilters(
  searchParams: URLSearchParams,
  initialData: HeatmapData
): HeatmapFilters {
  const rawPeriod = searchParams.get('heatmapPeriod');
  const rawAgent = searchParams.get('heatmapAgent');
  const availablePeriods = new Set<HeatmapPeriod>(initialData.availablePeriods);
  const availableAgents = new Set<HeatmapAgentFilter>(
    initialData.availableAgents.map((a) => a.value)
  );

  const period: HeatmapPeriod =
    rawPeriod && isValidPeriod(rawPeriod) && availablePeriods.has(rawPeriod)
      ? rawPeriod
      : initialData.filters.period;

  const agentCandidate: HeatmapAgentFilter | null =
    rawAgent === 'all' || (rawAgent && ALL_AGENTS.includes(rawAgent as typeof ALL_AGENTS[number]))
      ? (rawAgent as HeatmapAgentFilter)
      : null;

  const agent: HeatmapAgentFilter =
    agentCandidate && availableAgents.has(agentCandidate)
      ? agentCandidate
      : initialData.filters.agent;

  return { period, agent };
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
    refetchInterval: 30000,
    staleTime: 15000,
    placeholderData: (previous) => previous,
  });

  const heatmap = data ?? initialData;

  const updateFilters = (next: HeatmapFilters) => {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.period === 'last-12-months') {
      params.delete('heatmapPeriod');
    } else {
      params.set('heatmapPeriod', next.period);
    }
    if (next.agent === 'all') {
      params.delete('heatmapAgent');
    } else {
      params.set('heatmapAgent', next.agent);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '?', { scroll: false });
  };

  const { weeks, monthLabels } = useMemo(
    () =>
      buildHeatmapGrid(
        heatmap.days,
        parseIsoDate(heatmap.startDate),
        parseIsoDate(heatmap.endDate)
      ),
    [heatmap.days, heatmap.startDate, heatmap.endDate]
  );

  const maxJobs = useMemo(() => getMaxJobCount(heatmap.days), [heatmap.days]);
  const hasActivity = heatmap.totalJobs > 0;

  // Hide agent filter if 0 or 1 distinct agents present (availableAgents always includes 'all')
  const showAgentFilter = heatmap.availableAgents.length > 2;
  const showYearSelector = heatmap.availablePeriods.length > 1;

  const periodLabel = getPeriodLabel(heatmap.filters.period);

  return (
    <section
      className="mt-10 w-full aurora-bg-section rounded-lg border border-border/50 p-4 sm:p-6"
      data-testid="activity-heatmap"
      aria-label="Activity heatmap"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Activity</h2>
          <p
            className="text-sm text-muted-foreground mt-1"
            data-testid="activity-heatmap-counter"
          >
            {heatmap.totalJobs.toLocaleString('en-US')} jobs ·{' '}
            {heatmap.totalShipped.toLocaleString('en-US')} tickets shipped in{' '}
            {heatmap.filters.period === 'last-12-months'
              ? 'the last year'
              : periodLabel}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                updateFilters({ ...filters, period: value as HeatmapPeriod })
              }
            >
              <SelectTrigger
                className="w-full sm:w-[180px]"
                data-testid="heatmap-period-filter"
              >
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {heatmap.availablePeriods.map((period) => (
                  <SelectItem key={period} value={period}>
                    {getPeriodLabel(period)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="mt-6">
        {hasActivity ? (
          <TooltipProvider delayDuration={100}>
            <div className="overflow-x-auto" data-testid="activity-heatmap-scroll">
              <div className="flex min-w-fit gap-2">
                <div className="flex flex-col pt-5 pr-1 text-[10px] text-muted-foreground sticky left-0 z-10 bg-background/80 backdrop-blur-sm">
                  {DAY_LABELS.map((label, idx) => (
                    <div
                      key={label}
                      className="h-[14px] leading-[14px] mb-[2px]"
                      aria-hidden={!VISIBLE_DAY_ROWS.has(idx)}
                    >
                      {VISIBLE_DAY_ROWS.has(idx) ? label : ''}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col">
                  <div
                    className="relative h-4 mb-1"
                    style={{ width: `${weeks.length * 14}px` }}
                  >
                    {monthLabels.map(({ weekIndex, month }) => (
                      <span
                        key={`${weekIndex}-${month}`}
                        className="absolute text-[10px] text-muted-foreground"
                        style={{ left: `${weekIndex * 14}px` }}
                      >
                        {month}
                      </span>
                    ))}
                  </div>

                  <div
                    className="grid grid-flow-col gap-[2px]"
                    style={{
                      gridTemplateRows: 'repeat(7, 12px)',
                      gridAutoColumns: '12px',
                    }}
                    role="grid"
                    aria-label="Daily activity"
                  >
                    {weeks.flatMap((week, weekIdx) =>
                      week.map((cell, dayIdx) => {
                        const key = `${weekIdx}-${dayIdx}`;
                        if (!cell) {
                          return (
                            <div
                              key={key}
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                          );
                        }
                        const level = getIntensityLevel(cell.day.jobCount, maxJobs);
                        const hasCost = cell.day.hasCost;
                        return (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={cn(
                                  'w-3 h-3 rounded-[2px] transition-transform hover:scale-125 focus:outline-none focus:ring-1 focus:ring-violet-400',
                                  INTENSITY_CLASSES[level]
                                )}
                                data-date={cell.date}
                                data-intensity={level}
                                data-jobs={cell.day.jobCount}
                                aria-label={`${formatTooltipDate(cell.date)}: ${cell.day.jobCount} jobs`}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="font-semibold">
                                {formatTooltipDate(cell.date)}
                              </div>
                              <div className="mt-1 space-y-0.5">
                                <div>
                                  {cell.day.jobCount === 0
                                    ? 'No jobs'
                                    : `${cell.day.jobCount} job${cell.day.jobCount === 1 ? '' : 's'}`}
                                  {hasCost && (
                                    <span className="text-muted-foreground">
                                      {' '}
                                      · ${cell.day.totalCost.toFixed(2)}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  {cell.day.ticketsShipped === 0
                                    ? 'No tickets shipped'
                                    : `${cell.day.ticketsShipped} ticket${cell.day.ticketsShipped === 1 ? '' : 's'} shipped`}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TooltipProvider>
        ) : (
          <div
            className="flex items-center justify-center min-h-[140px] text-sm text-muted-foreground"
            data-testid="activity-heatmap-empty"
          >
            No activity to show yet — your AI work will appear here
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span
              key={level}
              className={cn('w-3 h-3 rounded-[2px]', INTENSITY_CLASSES[level])}
              aria-hidden="true"
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  );
}

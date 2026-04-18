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
import {
  HEATMAP_ROLLING_PERIOD,
  isHeatmapAgentFilter,
  type ActivityHeatmapData,
  type HeatmapAgentFilter,
  type HeatmapFilters,
  type HeatmapPeriod,
} from '@/lib/activity-heatmap/types';
import { normalizePeriodValue } from '@/lib/activity-heatmap/period';
import {
  buildHeatmapGrid,
  buildMonthLabels,
  getIntensityLevel,
} from '@/lib/activity-heatmap/grid';

interface ActivityHeatmapProps {
  initialData: ActivityHeatmapData;
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const INTENSITY_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'aurora-heat-0',
  1: 'aurora-heat-1',
  2: 'aurora-heat-2',
  3: 'aurora-heat-3',
  4: 'aurora-heat-4',
};

const QUERY_KEY = (filters: HeatmapFilters) =>
  ['activity-heatmap', filters.period, filters.agent] as const;

async function fetchHeatmap(filters: HeatmapFilters): Promise<ActivityHeatmapData> {
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

function filtersMatch(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.period === b.period && a.agent === b.agent;
}

function getInitialFilters(
  searchParams: URLSearchParams,
  initial: ActivityHeatmapData
): HeatmapFilters {
  const period = normalizePeriodValue(searchParams.get('heatmap-period'));
  const rawAgent = searchParams.get('heatmap-agent');
  const agent = rawAgent && isHeatmapAgentFilter(rawAgent) ? rawAgent : initial.filters.agent;
  return { period, agent };
}

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10));
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatCost(totalCost: number): string {
  return `$${totalCost.toFixed(2)}`;
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(searchParams, initialData)
  );

  const usesInitialData = filtersMatch(filters, initialData.filters);

  const { data } = useQuery({
    queryKey: QUERY_KEY(filters),
    queryFn: () => fetchHeatmap(filters),
    initialData: usesInitialData ? initialData : undefined,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const heatmap = data ?? initialData;

  const weeks = useMemo(
    () =>
      buildHeatmapGrid(heatmap.period.startDate, heatmap.period.endDate, heatmap.days),
    [heatmap.period.startDate, heatmap.period.endDate, heatmap.days]
  );
  const monthLabels = useMemo(() => buildMonthLabels(weeks), [weeks]);

  const updateFilters = (next: HeatmapFilters) => {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.period === HEATMAP_ROLLING_PERIOD) {
      params.delete('heatmap-period');
    } else {
      params.set('heatmap-period', next.period);
    }
    if (next.agent === 'all') {
      params.delete('heatmap-agent');
    } else {
      params.set('heatmap-agent', next.agent);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '?', { scroll: false });
  };

  const showAgentFilter = heatmap.availableAgents.length > 2; // 'all' + at least 2 agents
  const showPeriodSelect = heatmap.periodOptions.length > 1;
  const hasActivity = heatmap.totals.jobCount > 0;

  return (
    <section
      aria-label="AI activity heatmap"
      className="rounded-lg border border-border/50 aurora-bg-subtle p-4 sm:p-6"
      data-testid="activity-heatmap"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">AI activity</h2>
          <p className="text-sm text-muted-foreground" data-testid="activity-heatmap-counter">
            {heatmap.totals.jobCount.toLocaleString()} job
            {heatmap.totals.jobCount === 1 ? '' : 's'} · {heatmap.totals.ticketsShipped.toLocaleString()}{' '}
            ticket{heatmap.totals.ticketsShipped === 1 ? '' : 's'} shipped{' '}
            {heatmap.period.value === HEATMAP_ROLLING_PERIOD
              ? 'in the last 12 months'
              : `in ${heatmap.period.label}`}
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
            value={filters.period}
            disabled={!showPeriodSelect}
            onValueChange={(value) =>
              updateFilters({ ...filters, period: value as HeatmapPeriod })
            }
          >
            <SelectTrigger
              className="w-full sm:w-[160px]"
              data-testid="activity-heatmap-period-filter"
            >
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              {heatmap.periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <div className="inline-flex min-w-full">
          {/* Sticky day-of-week labels */}
          <div
            className="sticky left-0 z-10 mr-2 flex flex-col gap-[3px] pr-1 text-[10px] text-muted-foreground aurora-bg-subtle"
            aria-hidden="true"
          >
            {/* Spacer row to align with month labels on top */}
            <div className="h-[14px]" />
            {DAY_LABELS.map((label, i) => (
              <div key={i} className="flex h-[12px] items-center">
                {label}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="relative flex-1">
            {/* Month labels row */}
            <div
              className="relative mb-1 h-[14px] text-[10px] text-muted-foreground"
              aria-hidden="true"
            >
              {monthLabels.map((m) => (
                <span
                  key={`${m.weekIndex}-${m.label}`}
                  className="absolute top-0"
                  style={{ left: `${m.weekIndex * 15}px` }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {hasActivity ? (
              <TooltipProvider delayDuration={100}>
                <div className="flex gap-[3px]" role="grid" aria-label="AI activity heatmap grid">
                  {weeks.map((week) => (
                    <div
                      key={week.startIso}
                      className="flex flex-col gap-[3px]"
                      role="row"
                    >
                      {week.cells.map((cell, i) =>
                        cell.date == null ? (
                          <div
                            key={i}
                            className="h-[12px] w-[12px]"
                            aria-hidden="true"
                          />
                        ) : (
                          <HeatmapCellButton
                            key={cell.date}
                            date={cell.date}
                            jobCount={cell.day?.jobCount ?? 0}
                            totalCost={cell.day?.totalCost ?? 0}
                            costIncomplete={cell.day?.costIncomplete ?? false}
                            shippedTickets={cell.day?.shippedTickets ?? []}
                          />
                        )
                      )}
                    </div>
                  ))}
                </div>
              </TooltipProvider>
            ) : (
              <div
                className="flex h-[calc(7*12px+6*3px)] items-center justify-center rounded-md border border-dashed border-border/60 px-4 text-center text-sm text-muted-foreground"
                data-testid="activity-heatmap-empty"
              >
                No activity to show yet — your AI work will appear here
              </div>
            )}

            {/* Legend */}
            <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
              <span>Less</span>
              {([0, 1, 2, 3, 4] as const).map((level) => (
                <span
                  key={level}
                  className={`inline-block h-[12px] w-[12px] rounded-sm ${INTENSITY_CLASS[level]}`}
                  aria-hidden="true"
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface HeatmapCellButtonProps {
  date: string;
  jobCount: number;
  totalCost: number;
  costIncomplete: boolean;
  shippedTickets: ActivityHeatmapData['days'][number]['shippedTickets'];
}

function HeatmapCellButton({
  date,
  jobCount,
  totalCost,
  costIncomplete,
  shippedTickets,
}: HeatmapCellButtonProps) {
  const level = getIntensityLevel(jobCount);
  const showCost = jobCount > 0 && !costIncomplete;
  const label = `${jobCount} job${jobCount === 1 ? '' : 's'} on ${formatLongDate(date)}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="activity-heatmap-cell"
          data-date={date}
          data-job-count={jobCount}
          data-level={level}
          aria-label={label}
          className={`h-[12px] w-[12px] rounded-sm transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring ${INTENSITY_CLASS[level]}`}
        />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-[220px] space-y-1 bg-popover p-3 text-popover-foreground shadow-md"
      >
        <p className="text-xs font-medium">{formatLongDate(date)}</p>
        <p className="text-xs">
          {jobCount} job{jobCount === 1 ? '' : 's'}
          {showCost ? ` · ${formatCost(totalCost)}` : ''}
        </p>
        {shippedTickets.length > 0 && (
          <div className="text-xs">
            <p className="font-medium">Shipped:</p>
            <ul className="mt-0.5 space-y-0.5">
              {shippedTickets.map((t) => (
                <li key={t.ticketKey} className="truncate">
                  <span className="font-mono">{t.ticketKey}</span> — {t.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

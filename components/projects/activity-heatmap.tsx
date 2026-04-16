'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import { formatHeaderCopy, getIntensityClass } from '@/lib/heatmap/aggregations';
import type {
  HeatmapAgentFilter,
  HeatmapData,
  HeatmapDayCell,
  HeatmapFilters,
  HeatmapPeriod,
} from '@/lib/heatmap/types';
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

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function filtersMatch(left: HeatmapFilters, right: HeatmapFilters): boolean {
  return left.period === right.period && left.agent === right.agent;
}

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams({ period: filters.period, agent: filters.agent });
  const response = await fetch(`/api/heatmap?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch heatmap');
  }
  return response.json() as Promise<HeatmapData>;
}

function formatTooltipDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function groupByWeek(days: HeatmapDayCell[]): HeatmapDayCell[][] {
  const weeks: HeatmapDayCell[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

interface MonthLabel {
  index: number;
  label: string;
}

function computeMonthLabels(weeks: HeatmapDayCell[][]): MonthLabel[] {
  const labels: MonthLabel[] = [];
  let lastMonth = -1;
  weeks.forEach((week, weekIndex) => {
    const firstInPeriod = week.find((cell) => cell.inPeriod);
    const anchor = firstInPeriod ?? week[0];
    if (!anchor) return;
    const [, m] = anchor.date.split('-').map(Number) as [number, number, number];
    const month = m - 1;
    if (month !== lastMonth) {
      labels.push({ index: weekIndex, label: MONTH_LABELS[month] ?? '' });
      lastMonth = month;
    }
  });
  return labels;
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<HeatmapFilters>(() => ({
    period:
      (searchParams?.get('period') as HeatmapPeriod | null) ?? initialData.filters.period,
    agent:
      (searchParams?.get('agent') as HeatmapAgentFilter | null) ?? initialData.filters.agent,
  }));

  const shouldUseInitialData = filtersMatch(filters, initialData.filters);

  const { data } = useQuery({
    queryKey: queryKeys.heatmap.data(filters.period, filters.agent),
    queryFn: () => fetchHeatmap(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const heatmap: HeatmapData = data ?? initialData;

  const updateFilters = (next: HeatmapFilters) => {
    setFilters(next);
    const params = new URLSearchParams({ period: next.period, agent: next.agent });
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const weeks = useMemo(() => groupByWeek(heatmap.days), [heatmap.days]);
  const monthLabels = useMemo(() => computeMonthLabels(weeks), [weeks]);

  const header = formatHeaderCopy(heatmap.filters.period, heatmap.totals);
  const isEmpty = heatmap.totals.jobCount === 0;

  const hasAgentFilter = heatmap.availableAgents.length > 0;
  const showPeriodSelector = heatmap.periodOptions.some((opt) => !opt.isDefault);

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-foreground">{header}</h2>
        <div className="flex flex-wrap gap-2">
          {showPeriodSelector && (
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
                {heatmap.periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasAgentFilter && (
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
                <SelectItem value="all">All</SelectItem>
                {heatmap.availableAgents.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">
          No activity yet — shipped tickets and AI jobs will appear here once your project starts running workflows.
        </p>
      ) : null}

      <div data-testid="heatmap-scroll" className="overflow-x-auto">
        <div className="flex min-w-max gap-2">
          <div
            data-testid="heatmap-dow-labels"
            className="sticky left-0 z-10 flex flex-col gap-[3px] bg-background pr-1 pt-5 text-[10px] text-muted-foreground"
          >
            {DOW_LABELS.map((label, idx) => (
              <span
                key={label}
                className="h-3 leading-3"
                style={{ visibility: idx % 2 === 1 ? 'visible' : 'hidden' }}
                aria-hidden={idx % 2 === 0}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex flex-col">
            <div className="mb-1 flex h-4 text-[10px] text-muted-foreground">
              {weeks.map((_, weekIndex) => {
                const monthLabel = monthLabels.find((m) => m.index === weekIndex);
                return (
                  <span key={weekIndex} className="w-3 shrink-0 md:w-3.5">
                    {monthLabel?.label}
                  </span>
                );
              })}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  {week.map((cell) => (
                    <HeatmapCell key={cell.date} cell={cell} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span
            key={level}
            data-testid="heatmap-legend-swatch"
            className={`h-3 w-3 rounded-sm md:h-3.5 md:w-3.5 ${getIntensityClass(level)}`}
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

interface HeatmapCellProps {
  cell: HeatmapDayCell;
}

function HeatmapCell({ cell }: HeatmapCellProps) {
  const [open, setOpen] = useState(false);

  if (!cell.inPeriod) {
    return (
      <span
        aria-hidden
        className="h-3 w-3 rounded-sm bg-transparent md:h-3.5 md:w-3.5"
      />
    );
  }

  const classes = `h-3 w-3 rounded-sm md:h-3.5 md:w-3.5 ${getIntensityClass(cell.intensityLevel)}`;

  if (cell.jobCount === 0) {
    return <span aria-label={cell.date} className={classes} />;
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${cell.date}: ${cell.jobCount} jobs`}
          className={classes}
          onClick={() => setOpen((v) => !v)}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        />
      </TooltipTrigger>
      <TooltipContent data-testid="heatmap-tooltip">
        <div className="space-y-0.5">
          <div className="font-medium">{formatTooltipDate(cell.date)}</div>
          <div>
            {cell.jobCount} {cell.jobCount === 1 ? 'job' : 'jobs'}
          </div>
          {cell.shippedTicketCount > 0 ? (
            <div>
              {cell.shippedTicketCount}{' '}
              {cell.shippedTicketCount === 1 ? 'ticket shipped' : 'tickets shipped'}
            </div>
          ) : null}
          {cell.totalCost !== null ? (
            <div data-testid="heatmap-tooltip-cost">${cell.totalCost.toFixed(2)}</div>
          ) : null}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

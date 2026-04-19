'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endOfWeek, eachDayOfInterval, format, startOfWeek } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import {
  DEFAULT_PROJECTS_ACTIVITY_HEATMAP_AGENT,
  DEFAULT_PROJECTS_ACTIVITY_HEATMAP_PERIOD,
  type ProjectsActivityHeatmapCell,
  type ProjectsActivityHeatmapData,
  type ProjectsActivityHeatmapFilters,
} from '@/lib/projects/activity-heatmap-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ProjectsActivityHeatmapProps {
  initialData: ProjectsActivityHeatmapData;
}

interface HeatmapCalendarCell {
  date: string;
  label: string;
  weekIndex: number;
  dayOfWeek: number;
  jobCount: number;
  shippedTicketCount: number;
  totalCost: number | null;
  hasMissingCosts: boolean;
  intensityLevel: number;
}

interface HeatmapMonthLabel {
  month: string;
  weekIndex: number;
}

interface SearchParamsLike {
  get(name: string): string | null;
  toString(): string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const HEATMAP_LEVEL_CLASSES = [
  'border-border/70 bg-muted/20',
  'border-ctp-mauve/30 bg-ctp-mauve/15',
  'border-ctp-mauve/40 bg-ctp-mauve/25',
  'border-ctp-pink/45 bg-gradient-to-br from-ctp-mauve/35 to-ctp-pink/25',
  'border-ctp-pink/55 bg-gradient-to-br from-ctp-mauve/55 to-ctp-pink/40 shadow-[0_0_14px_hsl(var(--ctp-mauve)/0.18)]',
] as const;

async function fetchProjectsActivityHeatmap(
  filters: ProjectsActivityHeatmapFilters
): Promise<ProjectsActivityHeatmapData> {
  const params = new URLSearchParams({
    period: filters.period,
    agent: filters.agent,
  });
  const response = await fetch(`/api/projects/activity-heatmap?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch projects activity heatmap');
  }
  return response.json();
}

function filtersMatch(
  left: ProjectsActivityHeatmapFilters,
  right: ProjectsActivityHeatmapFilters
): boolean {
  return left.period === right.period && left.agent === right.agent;
}

function getInitialFilters(
  searchParams: SearchParamsLike,
  initialData: ProjectsActivityHeatmapData
): ProjectsActivityHeatmapFilters {
  return {
    period:
      searchParams.get('period') ??
      initialData.filters.period ??
      DEFAULT_PROJECTS_ACTIVITY_HEATMAP_PERIOD,
    agent:
      (searchParams.get('agent') as ProjectsActivityHeatmapFilters['agent'] | null) ??
      initialData.filters.agent ??
      DEFAULT_PROJECTS_ACTIVITY_HEATMAP_AGENT,
  };
}

function buildFilterSearchParams(
  searchParams: SearchParamsLike,
  filters: ProjectsActivityHeatmapFilters
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  params.set('period', filters.period);
  params.set('agent', filters.agent);
  return params;
}

function getIntensityLevel(jobCount: number, maxJobCount: number): number {
  if (jobCount <= 0 || maxJobCount <= 0) {
    return 0;
  }

  if (jobCount === maxJobCount) {
    return 4;
  }

  return Math.max(1, Math.ceil((jobCount / maxJobCount) * 4));
}

function buildHeatmapCalendar(
  data: ProjectsActivityHeatmapData
): {
  cells: HeatmapCalendarCell[];
  monthLabels: HeatmapMonthLabel[];
  weeksCount: number;
} {
  const periodStart = new Date(`${data.periodStart}T12:00:00.000Z`);
  const periodEnd = new Date(`${data.periodEnd}T12:00:00.000Z`);
  const intervalDays = eachDayOfInterval({
    start: periodStart,
    end: periodEnd,
  });
  const cellsByDate = new Map<string, ProjectsActivityHeatmapCell>(
    data.cells.map((cell) => [cell.date, cell])
  );
  const firstGridDate = startOfWeek(periodStart, { weekStartsOn: 0 });
  const lastGridDate = endOfWeek(periodEnd, { weekStartsOn: 0 });
  const weeksCount =
    Math.floor((lastGridDate.getTime() - firstGridDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const maxJobCount = data.cells.reduce((max, cell) => Math.max(max, cell.jobCount), 0);

  const cells = intervalDays.map((day) => {
    const date = format(day, 'yyyy-MM-dd');
    const cellData = cellsByDate.get(date);
    const weekIndex = Math.floor(
      (startOfWeek(day, { weekStartsOn: 0 }).getTime() - firstGridDate.getTime()) /
        (7 * 24 * 60 * 60 * 1000)
    );

    return {
      date,
      label: format(day, 'MMM d, yyyy'),
      weekIndex,
      dayOfWeek: day.getUTCDay(),
      jobCount: cellData?.jobCount ?? 0,
      shippedTicketCount: cellData?.shippedTicketCount ?? 0,
      totalCost: cellData?.totalCost ?? null,
      hasMissingCosts: cellData?.hasMissingCosts ?? false,
      intensityLevel: getIntensityLevel(cellData?.jobCount ?? 0, maxJobCount),
    };
  });

  const monthLabels: HeatmapMonthLabel[] = [];
  const seenMonths = new Set<string>();

  for (const day of intervalDays) {
    const monthKey = format(day, 'yyyy-MM');
    if (seenMonths.has(monthKey)) {
      continue;
    }

    seenMonths.add(monthKey);
    monthLabels.push({
      month: format(day, 'MMM'),
      weekIndex: Math.floor(
        (startOfWeek(day, { weekStartsOn: 0 }).getTime() - firstGridDate.getTime()) /
          (7 * 24 * 60 * 60 * 1000)
      ),
    });
  }

  return {
    cells,
    monthLabels,
    weeksCount,
  };
}

function formatSummary(data: ProjectsActivityHeatmapData): string {
  return `${data.summary.jobCount} jobs · ${data.summary.shippedTicketCount} tickets shipped ${data.summary.label}`;
}

function formatCost(totalCost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(totalCost);
}

function buildCellAriaLabel(cell: HeatmapCalendarCell): string {
  const segments = [`${cell.label}`];
  segments.push(`${cell.jobCount} jobs`);
  segments.push(`${cell.shippedTicketCount} tickets shipped`);
  return segments.join(', ');
}

export function ProjectsActivityHeatmap({ initialData }: ProjectsActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ProjectsActivityHeatmapFilters>(() =>
    getInitialFilters(searchParams, initialData)
  );
  const [openDate, setOpenDate] = useState<string | null>(null);
  const shouldUseInitialData = filtersMatch(filters, initialData.filters);

  const { data } = useQuery({
    queryKey: queryKeys.projects.activityHeatmap(filters.period, filters.agent),
    queryFn: () => fetchProjectsActivityHeatmap(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    placeholderData: (previousData) => previousData,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const heatmap = data ?? initialData;
  const showAgentFilter = heatmap.availableAgents.length > 1;
  const calendar = useMemo(() => buildHeatmapCalendar(heatmap), [heatmap]);

  const updateFilters = (nextFilters: ProjectsActivityHeatmapFilters) => {
    setFilters(nextFilters);
    const params = buildFilterSearchParams(searchParams, nextFilters);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <Card className="overflow-hidden border-border/80 aurora-bg-card-mauve">
      <CardHeader className="gap-4 border-b border-border/60">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-foreground">Activity</CardTitle>
            <p className="text-sm text-muted-foreground">{formatSummary(heatmap)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={filters.period}
              onValueChange={(value) =>
                updateFilters({
                  ...filters,
                  period: value,
                })
              }
              disabled={heatmap.availablePeriods.length <= 1}
            >
              <SelectTrigger
                className="w-full min-w-[180px]"
                data-testid="projects-heatmap-period-filter"
              >
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {heatmap.availablePeriods.map((period) => (
                  <SelectItem key={period.value} value={period.value}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {showAgentFilter && (
              <Select
                value={filters.agent}
                onValueChange={(value) =>
                  updateFilters({
                    ...filters,
                    agent: value as ProjectsActivityHeatmapFilters['agent'],
                  })
                }
              >
                <SelectTrigger
                  className="w-full min-w-[180px]"
                  data-testid="projects-heatmap-agent-filter"
                >
                  <SelectValue placeholder="Agent" />
                </SelectTrigger>
                <SelectContent>
                  {heatmap.availableAgents.map((agent) => (
                    <SelectItem key={agent.value} value={agent.value}>
                      {agent.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        {heatmap.hasAnyActivity ? (
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-max gap-x-3 gap-y-2" style={{ gridTemplateColumns: 'auto auto' }}>
              <div className="sticky left-0 z-20 h-5 bg-card/95 pr-3 backdrop-blur">
                <span className="sr-only">Day labels</span>
              </div>
              <div className="relative h-5" style={{ width: `${calendar.weeksCount * 24}px` }}>
                {calendar.monthLabels.map((label) => (
                  <span
                    key={`${label.month}-${label.weekIndex}`}
                    className="absolute text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
                    style={{ left: `${label.weekIndex * 24}px` }}
                  >
                    {label.month}
                  </span>
                ))}
              </div>

              <div className="sticky left-0 z-20 grid grid-rows-7 gap-1 bg-card/95 pr-3 backdrop-blur">
                {DAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="flex h-5 items-center text-[11px] text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>

              <div
                className="grid gap-1"
                style={{
                  gridTemplateColumns: `repeat(${calendar.weeksCount}, 20px)`,
                  gridTemplateRows: 'repeat(7, 20px)',
                }}
              >
                {calendar.cells.map((cell) => (
                  <div
                    key={cell.date}
                    style={{
                      gridColumnStart: cell.weekIndex + 1,
                      gridRowStart: cell.dayOfWeek + 1,
                    }}
                  >
                    <Popover
                      open={openDate === cell.date}
                      onOpenChange={(open) => setOpenDate(open ? cell.date : null)}
                    >
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={buildCellAriaLabel(cell)}
                          className={cn(
                            'h-5 w-5 rounded-[5px] border transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            HEATMAP_LEVEL_CLASSES[cell.intensityLevel]
                          )}
                          onMouseEnter={() => setOpenDate(cell.date)}
                          onFocus={() => setOpenDate(cell.date)}
                          onClick={() =>
                            setOpenDate((currentDate) =>
                              currentDate === cell.date ? null : cell.date
                            )
                          }
                        />
                      </PopoverTrigger>
                      <PopoverContent
                        side="top"
                        align="center"
                        className="w-56 border-border/80 bg-popover/95 backdrop-blur"
                      >
                        <div className="space-y-1 text-sm">
                          <p className="font-medium text-foreground">{cell.label}</p>
                          <p className="text-muted-foreground">
                            {cell.shippedTicketCount} tickets shipped
                          </p>
                          <p className="text-muted-foreground">{cell.jobCount} jobs</p>
                          {!cell.hasMissingCosts && cell.totalCost != null && cell.jobCount > 0 && (
                            <p className="text-muted-foreground">{formatCost(cell.totalCost)} total cost</p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/30 px-6 text-center text-sm text-muted-foreground">
            No activity to show yet — your AI work will appear here
          </div>
        )}

        <div className="flex justify-end">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Less</span>
            {HEATMAP_LEVEL_CLASSES.map((className, index) => (
              <span
                key={`legend-${index}`}
                className={cn('inline-block h-3.5 w-3.5 rounded-[4px] border', className)}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

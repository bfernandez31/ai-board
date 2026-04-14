'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryKeys } from '@/app/lib/query-keys';
import { cn } from '@/lib/utils';
import {
  type ActivityHeatmapAgentScopeValue,
  type ActivityHeatmapYearViewValue,
  type HeatmapDay,
  type ProjectsActivityHeatmapResponse,
} from '@/lib/projects/activity-heatmap-types';

interface ProjectsActivityHeatmapProps {
  initialData: ProjectsActivityHeatmapResponse;
}

interface ActivityHeatmapFilters {
  view: ActivityHeatmapYearViewValue;
  agent: ActivityHeatmapAgentScopeValue;
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const intensityClassNames: Record<HeatmapDay['intensityLevel'], string> = {
  0: 'border-border/60 bg-muted/60',
  1: 'border-ctp-lavender/20 bg-ctp-lavender/15',
  2: 'border-ctp-lavender/35 bg-ctp-lavender/30',
  3: 'border-ctp-mauve/40 bg-ctp-mauve/40',
  4: 'border-ctp-pink/45 bg-ctp-pink/55',
};

const weekdayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''] as const;

function filtersMatch(
  filters: ActivityHeatmapFilters,
  initialData: ProjectsActivityHeatmapResponse
): boolean {
  return (
    filters.view === initialData.view.value &&
    filters.agent === initialData.filters.agent
  );
}

function getInitialState(
  searchParams: URLSearchParams,
  initialData: ProjectsActivityHeatmapResponse
): ActivityHeatmapFilters {
  const requestedView = searchParams.get('view');
  const requestedAgent = searchParams.get('agent');

  return {
    view: (requestedView as ActivityHeatmapYearViewValue) || initialData.view.value,
    agent: (requestedAgent as ActivityHeatmapAgentScopeValue) || initialData.filters.agent,
  };
}

function buildSearchParams(
  searchParams: URLSearchParams,
  view: ActivityHeatmapYearViewValue,
  agent: ActivityHeatmapAgentScopeValue
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  params.set('view', view);
  params.set('agent', agent);
  return params;
}

async function fetchProjectsActivityHeatmap(
  view: ActivityHeatmapYearViewValue,
  agent: ActivityHeatmapAgentScopeValue
): Promise<ProjectsActivityHeatmapResponse> {
  const params = new URLSearchParams({
    view,
    agent,
  });

  const response = await fetch(`/api/projects/activity?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch project activity heatmap');
  }

  return response.json();
}

function getCellAriaLabel(day: HeatmapDay): string {
  return `${day.displayDate}: ${day.jobCount} jobs, ${day.ticketsShipped} tickets shipped, ${currencyFormatter.format(day.costUsd)} cost`;
}

function renderTooltip(day: HeatmapDay) {
  return (
    <div className="space-y-1">
      <div className="font-medium">{day.displayDate}</div>
      <div>{day.jobCount} jobs</div>
      <div>{day.ticketsShipped} tickets shipped</div>
      <div>{currencyFormatter.format(day.costUsd)} cost</div>
    </div>
  );
}

function getRefreshStateLabel(isError: boolean, isFetching: boolean): string {
  if (isError) {
    return 'Refresh failed';
  }

  if (isFetching) {
    return 'Refreshing activity…';
  }

  return 'Updated automatically every 15 seconds';
}

export function ProjectsActivityHeatmap({
  initialData,
}: ProjectsActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => getInitialState(searchParams, initialData));

  const shouldUseInitialData = filtersMatch(filters, initialData);

  const { data, isFetching, isError } = useQuery({
    queryKey: queryKeys.projects.activityHeatmap(filters.view, filters.agent),
    queryFn: () => fetchProjectsActivityHeatmap(filters.view, filters.agent),
    initialData: shouldUseInitialData ? initialData : undefined,
    placeholderData: (previousData) => previousData,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  const heatmap = data ?? initialData;
  const weekCount = (heatmap.days.at(-1)?.weekIndex ?? -1) + 1;
  const monthMarkers = heatmap.days.filter((day) => day.monthLabel);

  const updateFilters = (next: Partial<ActivityHeatmapFilters>) => {
    const nextFilters = {
      view: next.view ?? filters.view,
      agent: next.agent ?? filters.agent,
    };

    setFilters(nextFilters);
    const params = buildSearchParams(searchParams, nextFilters.view, nextFilters.agent);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <Card className="border-ctp-mauve/15 aurora-bg-subtle">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle className="text-xl text-foreground">Workspace activity</CardTitle>
            <CardDescription className="max-w-2xl">
              {heatmap.summary.jobCount} jobs · {heatmap.summary.ticketsShipped} tickets shipped in{' '}
              {heatmap.summary.rangeLabel}
            </CardDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={filters.view}
              onValueChange={(value) =>
                updateFilters({ view: value as ActivityHeatmapYearViewValue })
              }
            >
              <SelectTrigger
                className="w-full min-w-[180px]"
                data-testid="projects-activity-view-filter"
              >
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent>
                {heatmap.availableViews.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.agent}
              onValueChange={(value) =>
                updateFilters({ agent: value as ActivityHeatmapAgentScopeValue })
              }
            >
              <SelectTrigger
                className="w-full min-w-[180px]"
                data-testid="projects-activity-agent-filter"
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
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span data-testid="projects-activity-refresh-state">
            {getRefreshStateLabel(isError, isFetching)}
          </span>

          <div className="flex flex-wrap items-center gap-2" data-testid="projects-activity-legend">
            {heatmap.legend.map((bucket) => (
              <div key={bucket.level} className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-3.5 w-3.5 rounded-sm border',
                    intensityClassNames[bucket.level]
                  )}
                />
                <span>{bucket.label}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!heatmap.summary.hasAnyActivity && (
          <div
            className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground"
            data-testid="projects-activity-empty-state"
          >
            No matching workspace activity for this year and agent scope yet.
          </div>
        )}

        <div className="overflow-x-auto pb-2">
          <div className="min-w-max space-y-2">
            <div className="grid items-end gap-2" style={{ gridTemplateColumns: `36px repeat(${weekCount}, 14px)` }}>
              <div />
              {monthMarkers.map((day) => (
                <div
                  key={day.date}
                  className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs"
                  style={{ gridColumnStart: day.weekIndex + 2 }}
                >
                  {day.monthLabel}
                </div>
              ))}
            </div>

            <div className="grid gap-2" style={{ gridTemplateColumns: `36px repeat(${weekCount}, 14px)` }}>
              <div
                className="grid grid-rows-7 text-[10px] text-muted-foreground sm:text-xs"
                aria-hidden="true"
              >
                {weekdayLabels.map((label, index) => (
                  <div key={`${label}-${index}`} className="flex h-[14px] items-center">
                    {label}
                  </div>
                ))}
              </div>

              <div
                className="grid grid-flow-col grid-rows-7 gap-1"
                style={{ gridTemplateColumns: `repeat(${weekCount}, 14px)` }}
                data-testid="projects-activity-grid"
              >
                {heatmap.days.map((day) => (
                  <Tooltip key={day.date}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={getCellAriaLabel(day)}
                        data-testid="projects-activity-cell"
                        data-date={day.date}
                        data-intensity={day.intensityLevel}
                        className={cn(
                          'h-[14px] w-[14px] rounded-[4px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
                          intensityClassNames[day.intensityLevel]
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{renderTooltip(day)}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Jobs</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {heatmap.summary.jobCount}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Tickets shipped</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {heatmap.summary.ticketsShipped}
            </div>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Recorded cost</div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {currencyFormatter.format(heatmap.summary.costUsd)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  ProjectsActivityDay,
  ProjectsActivityFilterOption,
  ProjectsActivityResponse,
} from '@/lib/projects/activity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProjectsActivityHeatmapProps {
  initialData: ProjectsActivityResponse;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function getIntensityClass(intensity: ProjectsActivityDay['intensity']): string {
  switch (intensity) {
    case 0:
      return 'bg-muted/40 border-border/60';
    case 1:
      return 'bg-violet-950/80 border-violet-900/70';
    case 2:
      return 'bg-violet-800/90 border-violet-700/80';
    case 3:
      return 'bg-violet-600/90 border-violet-500/80';
    case 4:
      return 'bg-fuchsia-500/90 border-fuchsia-400/80';
  }
}

function formatSummary(summary: ProjectsActivityResponse['summary']): string {
  const suffix =
    summary.periodLabel === 'Last 12 months'
      ? 'in the last year'
      : `in ${summary.periodLabel}`;

  return `${summary.totalJobs} jobs \u00b7 ${summary.ticketsShipped} tickets shipped ${suffix}`;
}

function formatTooltipDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function buildSearchParams(
  searchParams: URLSearchParams,
  filters: { year: string; agent: string }
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  params.set('year', filters.year);
  params.set('agent', filters.agent);
  return params;
}

async function fetchProjectsActivity(filters: {
  year: string;
  agent: string;
}): Promise<ProjectsActivityResponse> {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/projects/activity?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch projects activity');
  }

  return response.json();
}

function ActivityCell({ day }: { day: ProjectsActivityDay }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip delayDuration={120}>
        <TooltipTrigger asChild>
          <PopoverAnchor asChild>
            <button
              type="button"
              className={`h-5 w-5 rounded-[4px] border transition-colors ${getIntensityClass(day.intensity)}`}
              aria-label={`${day.jobCount} jobs on ${formatTooltipDate(day.date)}`}
              onClick={() => setOpen((current) => !current)}
              data-testid={`activity-cell-${day.date}`}
            />
          </PopoverAnchor>
        </TooltipTrigger>
        <TooltipContent side="top" className="hidden sm:block">
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">{formatTooltipDate(day.date)}</p>
            <p className="text-muted-foreground">{day.shippedTickets} tickets shipped</p>
            <p className="text-muted-foreground">{day.jobCount} jobs</p>
            {day.totalCostUsd !== null && (
              <p className="text-muted-foreground">{formatCurrency(day.totalCostUsd)} total cost</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      <PopoverContent side="top" className="w-56 sm:hidden">
        <div className="space-y-1 text-sm">
          <p className="font-medium text-foreground">{formatTooltipDate(day.date)}</p>
          <p className="text-muted-foreground">{day.shippedTickets} tickets shipped</p>
          <p className="text-muted-foreground">{day.jobCount} jobs</p>
          {day.totalCostUsd !== null && (
            <p className="text-muted-foreground">{formatCurrency(day.totalCostUsd)} total cost</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilterSelect({
  value,
  options,
  onValueChange,
  placeholder,
  testId,
}: {
  value: string;
  options: ProjectsActivityFilterOption[];
  onValueChange: (value: string) => void;
  placeholder: string;
  testId: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-full sm:w-[180px]" data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProjectsActivityHeatmap({
  initialData,
}: ProjectsActivityHeatmapProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ProjectsActivityResponse['filters']>(initialData.filters);

  const shouldUseInitialData =
    filters.year === initialData.filters.year && filters.agent === initialData.filters.agent;

  const { data } = useQuery({
    queryKey: queryKeys.projects.activityDashboard(filters.year, filters.agent),
    queryFn: () => fetchProjectsActivity(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    placeholderData: (previousData) => previousData,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const activity = data ?? initialData;
  const showAgentFilter = activity.availableAgents.length > 2;
  const showYearFilter = activity.periodOptions.length > 1;
  const gridWidth = `${activity.heatmap.totalWeeks * 24}px`;

  const updateFilters = (nextFilters: typeof filters) => {
    setFilters(nextFilters);
    const params = buildSearchParams(searchParams, nextFilters);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  return (
    <Card className="aurora-card border-border/60 overflow-hidden" data-testid="projects-activity-heatmap">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl text-foreground">Activity</CardTitle>
            <p className="text-sm text-muted-foreground">{formatSummary(activity.summary)}</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {showAgentFilter && (
              <FilterSelect
                value={filters.agent}
                options={activity.availableAgents}
                onValueChange={(agent) =>
                  updateFilters({ ...filters, agent: agent as ProjectsActivityResponse['filters']['agent'] })
                }
                placeholder="Agent"
                testId="projects-activity-agent-filter"
              />
            )}

              <FilterSelect
                value={filters.year}
                options={activity.periodOptions}
                onValueChange={(year) =>
                  updateFilters({ ...filters, year: year as ProjectsActivityResponse['filters']['year'] })
                }
                placeholder="Period"
                testId="projects-activity-year-filter"
              />

            {!showYearFilter && (
              <p className="text-xs text-muted-foreground self-center sm:text-right">
                Last 12 months only
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="shrink-0 pt-7">
            <div className="grid gap-1.5">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex h-5 items-center text-[11px] text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0 flex-1 overflow-x-auto pb-2">
            <div className="space-y-2" style={{ minWidth: gridWidth }}>
              <div
                className="grid gap-1.5 text-[11px] text-muted-foreground"
                style={{ gridTemplateColumns: `repeat(${activity.heatmap.totalWeeks}, minmax(0, 1fr))` }}
              >
                {activity.heatmap.weeks.map((week, index) => (
                  <div key={`${week.monthLabel ?? 'blank'}-${index}`} className="h-5">
                    {week.monthLabel}
                  </div>
                ))}
              </div>

              {activity.heatmap.hasActivity ? (
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: `repeat(${activity.heatmap.totalWeeks}, minmax(0, 1fr))` }}
                >
                  {activity.heatmap.weeks.map((week, weekIndex) => (
                    <div key={`week-${weekIndex}`} className="grid gap-1.5">
                      {week.days.map((day, dayIndex) =>
                        day ? (
                          <ActivityCell key={day.date} day={day} />
                        ) : (
                          <div key={`empty-${weekIndex}-${dayIndex}`} className="h-5 w-5" />
                        )
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[188px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-background/40 px-6 text-center text-sm text-muted-foreground">
                  No activity to show yet — your AI work will appear here
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((intensity) => (
              <span
                key={intensity}
                className={`h-3 w-3 rounded-sm border ${getIntensityClass(
                  intensity as ProjectsActivityDay['intensity']
                )}`}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

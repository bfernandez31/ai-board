'use client';

import type { Dispatch, JSX, ReactNode, SetStateAction } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import type {
  ProjectActivityDay,
  ProjectActivityHeatmapData,
  ProjectActivityHeatmapFilters,
} from '@/lib/projects/activity-heatmap';

interface ProjectActivityHeatmapProps {
  initialData: ProjectActivityHeatmapData;
}

interface TooltipData {
  title: string;
  activity: string;
  shipped: string;
  cost: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const HEATMAP_LEVEL_CLASSES = [
  'border-border/50 bg-transparent',
  'border-violet-500/20 bg-violet-500/10',
  'border-violet-500/30 bg-violet-500/25',
  'border-violet-400/40 bg-violet-400/50',
  'border-violet-300/60 bg-violet-300/80',
] as const;

const COST_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function pluralize(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildSummary(summary: ProjectActivityHeatmapData['summary']): string {
  return `${pluralize(summary.jobCount, 'job', 'jobs')} · ${pluralize(summary.shippedCount, 'ticket shipped', 'tickets shipped')} ${summary.label}`;
}

function buildQueryString(filters: ProjectActivityHeatmapFilters): string {
  const params = new URLSearchParams({
    year: filters.year,
    agent: filters.agent,
  });

  return params.toString();
}

async function fetchProjectActivity(filters: ProjectActivityHeatmapFilters): Promise<ProjectActivityHeatmapData> {
  const response = await fetch(`/api/projects/activity?${buildQueryString(filters)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch project activity');
  }

  return response.json();
}

function formatTooltip(day: ProjectActivityDay): TooltipData {
  const date = new Date(`${day.date}T00:00:00.000Z`);
  return {
    title: DATE_FORMATTER.format(date),
    activity: pluralize(day.jobCount, 'job', 'jobs'),
    shipped: pluralize(day.shippedCount, 'ticket shipped', 'tickets shipped'),
    cost: COST_FORMATTER.format(day.totalCost),
  };
}

function getCellClass(day: ProjectActivityDay): string {
  const baseClass = HEATMAP_LEVEL_CLASSES[day.intensityLevel];
  return day.isOutsidePeriod ? `${baseClass} opacity-30` : baseClass;
}

function updateYearFilter(
  setFilters: Dispatch<SetStateAction<ProjectActivityHeatmapFilters>>,
  year: string
): void {
  setFilters((current) => ({
    ...current,
    year: year as ProjectActivityHeatmapFilters['year'],
  }));
}

function updateAgentFilter(
  setFilters: Dispatch<SetStateAction<ProjectActivityHeatmapFilters>>,
  agent: string
): void {
  setFilters((current) => ({
    ...current,
    agent: agent as ProjectActivityHeatmapFilters['agent'],
  }));
}

function renderMonthLabel(weekIndex: number, monthLabelByWeek: Map<number, string>): ReactNode {
  return (
    <div key={weekIndex} className="h-4">
      {monthLabelByWeek.get(weekIndex) ?? ''}
    </div>
  );
}

export function ProjectActivityHeatmap({
  initialData,
}: ProjectActivityHeatmapProps): JSX.Element {
  const [filters, setFilters] = useState<ProjectActivityHeatmapFilters>(initialData.filters);
  const shouldUseInitialData =
    initialData.filters.year === filters.year && initialData.filters.agent === filters.agent;

  const { data } = useQuery({
    queryKey: ['projects', 'activity-heatmap', filters.year, filters.agent],
    queryFn: () => fetchProjectActivity(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const heatmap = data ?? initialData;
  const monthLabelByWeek = new Map(heatmap.monthLabels.map((label) => [label.weekIndex, label.label]));

  return (
    <section className="rounded-2xl border border-border aurora-bg-muted p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">Project Activity</h2>
          <p className="text-sm text-muted-foreground">{buildSummary(heatmap.summary)}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            value={filters.year}
            onValueChange={(year) => updateYearFilter(setFilters, year)}
          >
            <SelectTrigger className="w-full min-w-[180px]" data-testid="projects-activity-year-filter">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rolling">Last 12 months</SelectItem>
              {heatmap.availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.agent}
            onValueChange={(agent) => updateAgentFilter(setFilters, agent)}
          >
            <SelectTrigger className="w-full min-w-[180px]" data-testid="projects-activity-agent-filter">
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
        </div>
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="min-w-[720px]">
          <div
            className="ml-10 grid gap-1 text-xs text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${heatmap.weeks}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: heatmap.weeks }, (_, weekIndex) =>
              renderMonthLabel(weekIndex, monthLabelByWeek)
            )}
          </div>

          <div className="mt-2 flex gap-2">
            <div className="grid grid-rows-7 gap-1 pt-[1px] text-[11px] text-muted-foreground">
              {DAY_LABELS.map((label) => (
                <div key={label} className="flex h-3 w-8 items-center justify-end pr-1">
                  {label}
                </div>
              ))}
            </div>

            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${heatmap.weeks}, minmax(0, 1fr))`,
                gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
              }}
            >
              {heatmap.days.map((day) => {
                const tooltip = formatTooltip(day);
                return (
                  <Tooltip key={day.date}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={`h-3 w-3 rounded-[3px] border transition-colors ${getCellClass(day)}`}
                        aria-label={`${tooltip.title}: ${tooltip.activity}, ${tooltip.shipped}, ${tooltip.cost}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="space-y-1 bg-popover text-popover-foreground">
                      <div className="font-medium">{tooltip.title}</div>
                      <div>{tooltip.shipped}</div>
                      <div>{tooltip.activity}</div>
                      <div>{tooltip.cost}</div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        {HEATMAP_LEVEL_CLASSES.map((className, index) => (
          <span
            key={index}
            className={`h-3 w-3 rounded-[3px] border ${className}`}
            aria-hidden="true"
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

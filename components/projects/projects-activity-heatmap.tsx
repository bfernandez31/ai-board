'use client';

import { startTransition, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  type ProjectsActivityDayCell,
  type ProjectsActivityFilters,
  type ProjectsActivityHeatmapResponse,
} from '@/app/lib/types/project';
import { useProjectsActivityHeatmap } from '@/app/lib/hooks/queries/use-projects-activity-heatmap';
import {
  buildProjectsActivitySearchParams,
  parseSerializedProjectsActivityPeriod,
  serializeProjectsActivityPeriod,
} from '@/app/lib/utils/projects-activity-filters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const intensityClasses: Record<ProjectsActivityDayCell['intensityLevel'], string> = {
  0: 'bg-muted hover:bg-muted',
  1: 'bg-emerald-100 hover:bg-emerald-200',
  2: 'bg-emerald-200 hover:bg-emerald-300',
  3: 'bg-emerald-400 hover:bg-emerald-500',
  4: 'bg-emerald-600 hover:bg-emerald-700',
};

interface ProjectsActivityHeatmapProps {
  initialData: ProjectsActivityHeatmapResponse;
}

function buildWeeks(days: ProjectsActivityDayCell[]): ProjectsActivityDayCell[][] {
  const weeks = new Map<number, ProjectsActivityDayCell[]>();

  for (const day of days) {
    const existingWeek = weeks.get(day.weekIndex);

    if (existingWeek) {
      existingWeek.push(day);
      continue;
    }

    weeks.set(day.weekIndex, [day]);
  }

  return Array.from(weeks.values());
}

function formatJobLabel(count: number): string {
  return `${count} job${count === 1 ? '' : 's'}`;
}

function formatShippedLabel(count: number): string {
  return `${count} ticket${count === 1 ? '' : 's'} shipped`;
}

function formatCost(costUsd: number | null): string | null {
  if (costUsd === null) {
    return null;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(costUsd);
}

function DayDetails({ day }: { day: ProjectsActivityDayCell }) {
  const formattedCost = formatCost(day.costUsd);

  return (
    <div className="space-y-2">
      <div className="text-sm font-semibold text-foreground">
        {format(parseISO(day.date), 'MMMM d, yyyy')}
      </div>
      <div className="text-sm text-muted-foreground">{formatJobLabel(day.jobCount)}</div>
      <div className="text-sm text-muted-foreground">
        {formatShippedLabel(day.shippedTicketCount)}
      </div>
      {formattedCost ? (
        <div className="text-sm text-muted-foreground">{formattedCost} cost</div>
      ) : null}
      {day.shippedTickets.length > 0 ? (
        <div className="space-y-1 pt-1">
          {day.shippedTickets.map((ticket) => (
            <div key={ticket.ticketId} className="text-xs text-foreground">
              {ticket.ticketKey}: {ticket.title}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProjectsActivityHeatmap({
  initialData,
}: ProjectsActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ProjectsActivityFilters>(initialData.filters);
  const filtersRef = useRef<ProjectsActivityFilters>(initialData.filters);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const { data, isFetching } = useProjectsActivityHeatmap({
    filters,
    initialData,
  });

  const heatmap = data ?? initialData;
  const weeks = buildWeeks(heatmap.days);
  const realAgentOptionCount = heatmap.agentOptions.filter((option) => option.value !== 'all').length;
  const showAgentFilter = realAgentOptionCount > 1 || filters.agent !== 'all';

  function updateFilters(
    updater: (currentFilters: ProjectsActivityFilters) => ProjectsActivityFilters
  ) {
    startTransition(() => {
      const nextFilters = updater(filtersRef.current);
      filtersRef.current = nextFilters;
      setFilters(nextFilters);
      const nextSearchParams = buildProjectsActivitySearchParams(nextFilters, searchParams);
      router.push(`?${nextSearchParams.toString()}`, { scroll: false });
    });
  }

  return (
    <Card className="border-border/60 bg-card">
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl text-foreground">AI activity</CardTitle>
            <div className="text-sm text-muted-foreground">
              {heatmap.summary.summaryLabel}
            </div>
            {isFetching ? (
              <div className="text-xs text-muted-foreground">Refreshing activity…</div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {heatmap.periodOptions.length > 1 ? (
              <Select
                value={serializeProjectsActivityPeriod(filters)}
                onValueChange={(value) => {
                  const nextPeriod = parseSerializedProjectsActivityPeriod(value);
                  updateFilters((currentFilters) => ({
                    ...currentFilters,
                    ...nextPeriod,
                  }));
                }}
              >
                <SelectTrigger
                  className="w-full sm:w-[220px]"
                  data-testid="projects-activity-period-filter"
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
            ) : null}

            {showAgentFilter ? (
              <Select
                value={filters.agent}
                onValueChange={(value) =>
                  updateFilters((currentFilters) => ({
                    ...currentFilters,
                    agent: value as ProjectsActivityFilters['agent'],
                  }))
                }
              >
                <SelectTrigger
                  className="w-full sm:w-[180px]"
                  data-testid="projects-activity-agent-filter"
                >
                  <SelectValue placeholder="Agent" />
                </SelectTrigger>
                <SelectContent>
                  {heatmap.agentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Less activity</span>
          {heatmap.legendLevels.map((level) => (
            <span
              key={level}
              className={`h-3 w-3 rounded-[4px] ${intensityClasses[level]}`}
              data-testid={`projects-activity-legend-${level}`}
            />
          ))}
          <span>More activity</span>
        </div>
      </CardHeader>

      <CardContent>
        {heatmap.hasActivity ? (
          <div className="flex gap-3">
            <div className="shrink-0 bg-card pr-1">
              <div className="mb-2 h-5" aria-hidden />
              <div className="grid grid-rows-7 gap-2">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="flex h-5 items-center text-[10px] text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="overflow-x-auto pb-2"
              data-testid="projects-activity-scroll"
            >
              <div className="min-w-max">
                <div className="mb-2 grid grid-flow-col auto-cols-[1.25rem] gap-2">
                  {weeks.map((week, index) => (
                    <div
                      key={`month-${week[0]?.weekIndex ?? index}`}
                      className="h-5 text-[10px] text-muted-foreground"
                    >
                      {week.find((day) => day.monthLabel !== null)?.monthLabel ?? ''}
                    </div>
                  ))}
                </div>

                <div className="grid grid-flow-col auto-cols-[1.25rem] gap-2">
                  {weeks.map((week, index) => (
                    <div
                      key={`week-${week[0]?.weekIndex ?? index}`}
                      className="grid grid-rows-7 gap-2"
                    >
                      {week.map((day) => {
                        const isOpen =
                          selectedDate === day.date || hoveredDate === day.date;

                        return (
                          <Popover
                            key={day.date}
                            open={isOpen}
                            onOpenChange={(open) => {
                              if (!open && selectedDate === day.date) {
                                setSelectedDate(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                aria-label={`${day.date}: ${formatJobLabel(day.jobCount)}, ${formatShippedLabel(
                                  day.shippedTicketCount
                                )}`}
                                data-testid={`projects-activity-cell-${day.date}`}
                                className={`h-5 w-5 rounded-[4px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${intensityClasses[day.intensityLevel]}`}
                                style={{ gridRowStart: day.weekdayIndex + 1 }}
                                onMouseEnter={() => setHoveredDate(day.date)}
                                onMouseLeave={() => {
                                  if (selectedDate !== day.date) {
                                    setHoveredDate(null);
                                  }
                                }}
                                onFocus={() => setHoveredDate(day.date)}
                                onBlur={() => {
                                  if (selectedDate !== day.date) {
                                    setHoveredDate(null);
                                  }
                                }}
                                onClick={() => {
                                  setSelectedDate((currentValue) =>
                                    currentValue === day.date ? null : day.date
                                  );
                                }}
                              />
                            </PopoverTrigger>
                            <PopoverContent
                              align="center"
                              className="w-72"
                              onOpenAutoFocus={(event) => event.preventDefault()}
                            >
                              <DayDetails day={day} />
                            </PopoverContent>
                          </Popover>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-lg border border-dashed border-border/70 bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground"
            data-testid="projects-activity-empty-state"
          >
            No activity to show yet — your AI work will appear here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

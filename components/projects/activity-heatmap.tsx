'use client';

import { useMemo, useState } from 'react';
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
import { useActivityHeatmap } from '@/app/lib/hooks/queries/use-activity-heatmap';
import { ALL_AGENTS, AGENT_LABELS } from '@/app/lib/utils/agent-resolution';
import type { HeatmapDayData } from '@/app/api/activity/heatmap/route';
import { Loader2 } from 'lucide-react';

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Map of YYYY-MM-DD -> HeatmapDayData */
type DayMap = Map<string, HeatmapDayData>;

function getIntensityLevel(jobCount: number, maxJobs: number): number {
  if (jobCount === 0) return 0;
  if (maxJobs === 0) return 0;
  const ratio = jobCount / maxJobs;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const INTENSITY_CLASSES = [
  'bg-muted/40',
  'bg-violet-900/50',
  'bg-violet-700/60',
  'bg-violet-500/70',
  'bg-violet-400',
] as const;

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(2)}`;
}

interface HeatmapGridProps {
  yearStart: Date;
  yearEnd: Date;
  dayMap: DayMap;
  maxJobs: number;
}

function HeatmapGrid({ yearStart, yearEnd, dayMap, maxJobs }: HeatmapGridProps) {
  // Build the grid: weeks as columns, days as rows (0=Sun, 1=Mon, ..., 6=Sat)
  // GitHub style: rows are Mon-Sun (we display Mon at top)
  const weeks: (string | null)[][] = [];

  // Start from the beginning of the week containing yearStart (Monday)
  const gridStart = new Date(yearStart);
  const dayOfWeek = gridStart.getUTCDay();
  // Adjust to Monday (getUTCDay: 0=Sun, 1=Mon, ..., 6=Sat)
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  gridStart.setUTCDate(gridStart.getUTCDate() + mondayOffset);

  const current = new Date(gridStart);
  let currentWeek: (string | null)[] = [];

  while (current <= yearEnd || currentWeek.length > 0) {
    const weekday = current.getUTCDay();
    // Convert to Mon=0, Tue=1, ..., Sun=6
    const gridRow = weekday === 0 ? 6 : weekday - 1;

    if (gridRow === 0 && currentWeek.length > 0) {
      // Pad incomplete week
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weeks.push(currentWeek);
      currentWeek = [];
    }

    if (current > yearEnd) {
      // We've passed the end, pad and break
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      if (currentWeek.some((d) => d !== null)) {
        weeks.push(currentWeek);
      }
      break;
    }

    const dateStr = current.toISOString().slice(0, 10);
    const inRange = current >= yearStart && current <= yearEnd;
    currentWeek.push(inRange ? dateStr : null);

    current.setUTCDate(current.getUTCDate() + 1);
  }

  // Calculate month label positions
  const monthPositions: { label: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    const week = weeks[w]!;
    // Find the first valid date in this week
    const firstDate = week.find((d): d is string => d !== null);
    if (firstDate) {
      const month = parseInt(firstDate.slice(5, 7), 10) - 1;
      if (month !== lastMonth) {
        monthPositions.push({ label: MONTH_LABELS[month] ?? '', col: w });
        lastMonth = month;
      }
    }
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-0.5 min-w-fit">
        {/* Month labels */}
        <div className="flex gap-0.5 mb-1 ml-8">
          {monthPositions.map(({ label, col }, i) => {
            const nextEntry = monthPositions[i + 1];
            const nextCol = nextEntry ? nextEntry.col : weeks.length;
            const span = nextCol - col;
            return (
              <div
                key={`${label}-${col}`}
                className="text-xs text-muted-foreground"
                style={{ width: `${span * 13}px` }}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* Grid rows */}
        {Array.from({ length: 7 }, (_, row) => (
          <div key={row} className="flex items-center gap-0.5">
            {/* Day label */}
            <div className="w-7 text-xs text-muted-foreground text-right pr-1 shrink-0">
              {DAY_LABELS[row]}
            </div>

            {/* Cells */}
            {weeks.map((week, colIdx) => {
              const dateStr = week[row];
              if (!dateStr) {
                return (
                  <div
                    key={`empty-${colIdx}`}
                    className="w-[11px] h-[11px] rounded-sm"
                  />
                );
              }

              const dayData = dayMap.get(dateStr);
              const jobCount = dayData?.jobCount ?? 0;
              const shippedCount = dayData?.shippedCount ?? 0;
              const totalCost = dayData?.totalCost ?? 0;
              const level = getIntensityLevel(jobCount, maxJobs);

              return (
                <Tooltip key={dateStr} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-[11px] h-[11px] rounded-sm border border-border/30 transition-colors ${INTENSITY_CLASSES[level]}`}
                      data-testid={`heatmap-cell-${dateStr}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-popover text-popover-foreground border border-border shadow-lg p-2"
                  >
                    <div className="text-xs space-y-0.5">
                      <div className="font-medium">{formatDate(dateStr)}</div>
                      <div>
                        {jobCount} {jobCount === 1 ? 'job' : 'jobs'}
                        {totalCost > 0 && ` · ${formatCost(totalCost)}`}
                      </div>
                      <div>
                        {shippedCount}{' '}
                        {shippedCount === 1 ? 'ticket' : 'tickets'} shipped
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntensityLegend() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>Less</span>
      {INTENSITY_CLASSES.map((cls, i) => (
        <div
          key={i}
          className={`w-[11px] h-[11px] rounded-sm border border-border/30 ${cls}`}
        />
      ))}
      <span>More</span>
    </div>
  );
}

export function ActivityHeatmap() {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  const { data, isLoading } = useActivityHeatmap({
    year: selectedYear,
    agent: selectedAgent,
  });

  const { dayMap, maxJobs, yearStart, yearEnd } = useMemo(() => {
    if (!data) {
      return {
        dayMap: new Map() as DayMap,
        maxJobs: 0,
        yearStart: new Date(),
        yearEnd: new Date(),
      };
    }

    const map = new Map<string, HeatmapDayData>();
    let max = 0;
    for (const day of data.days) {
      map.set(day.date, day);
      if (day.jobCount > max) max = day.jobCount;
    }

    return {
      dayMap: map,
      maxJobs: max,
      yearStart: new Date(data.yearStart),
      yearEnd: new Date(data.yearEnd),
    };
  }, [data]);

  const yearLabel = selectedYear
    ? String(selectedYear)
    : 'Last 12 months';

  return (
    <TooltipProvider>
      <div className="aurora-bg-section rounded-lg border border-border p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Activity
            </h2>
            {data && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {data.totalJobs.toLocaleString()}{' '}
                {data.totalJobs === 1 ? 'job' : 'jobs'} &middot;{' '}
                {data.totalShipped.toLocaleString()}{' '}
                {data.totalShipped === 1 ? 'ticket' : 'tickets'} shipped in{' '}
                {yearLabel.toLowerCase()}
              </p>
            )}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select
              value={selectedAgent}
              onValueChange={setSelectedAgent}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {ALL_AGENTS.map((agent) => (
                  <SelectItem key={agent} value={agent}>
                    {AGENT_LABELS[agent]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedYear === null ? 'rolling' : String(selectedYear)}
              onValueChange={(v) =>
                setSelectedYear(v === 'rolling' ? null : parseInt(v, 10))
              }
            >
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rolling">Last 12 months</SelectItem>
                {(data?.availableYears ?? []).map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Heatmap Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            <HeatmapGrid
              yearStart={yearStart}
              yearEnd={yearEnd}
              dayMap={dayMap}
              maxJobs={maxJobs}
            />

            {/* Legend */}
            <div className="flex justify-end mt-3">
              <IntensityLegend />
            </div>
          </>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

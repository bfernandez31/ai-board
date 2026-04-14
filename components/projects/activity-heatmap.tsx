'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActivityHeatmap } from '@/hooks/use-activity-heatmap';
import type { HeatmapCell, HeatmapDayData, HeatmapFilters } from '@/lib/activity-heatmap/types';

const WEEKS = 52;
const DAYS_PER_WEEK = 7;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const INTENSITY_CLASSES = [
  'bg-ctp-surface0/50',
  'bg-ctp-mauve/25',
  'bg-ctp-mauve/40',
  'bg-ctp-mauve/60',
  'bg-ctp-mauve',
] as const;

function getIntensityLevel(jobCount: number, maxCount: number): 0 | 1 | 2 | 3 | 4 {
  if (jobCount === 0 || maxCount === 0) return 0;
  const ratio = jobCount / maxCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.50) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function formatCellDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCost(costUsd: number): string {
  return `$${costUsd.toFixed(2)}`;
}

function buildGrid(
  days: HeatmapDayData[],
  _periodStart: string,
  periodEnd: string
): HeatmapCell[][] {
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const maxCount = Math.max(0, ...days.map((d) => d.jobCount));

  const endDate = new Date(periodEnd + 'T00:00:00');
  const endDay = endDate.getDay();

  const totalCells = WEEKS * DAYS_PER_WEEK;
  const endOffset = endDay;
  const startOffset = totalCells - 1 - endOffset;

  const baseDate = new Date(endDate);
  baseDate.setDate(baseDate.getDate() - startOffset);

  const rows: HeatmapCell[][] = Array.from({ length: DAYS_PER_WEEK }, () => []);

  for (let col = 0; col < WEEKS; col++) {
    for (let row = 0; row < DAYS_PER_WEEK; row++) {
      const cellDate = new Date(baseDate);
      cellDate.setDate(cellDate.getDate() + col * DAYS_PER_WEEK + row);
      const dateStr = cellDate.toISOString().slice(0, 10);
      const data = dayMap.get(dateStr) ?? null;
      const level = data ? getIntensityLevel(data.jobCount, maxCount) : 0;
      rows[row]!.push({ date: cellDate, level, data });
    }
  }

  return rows;
}

function getMonthLabels(rows: HeatmapCell[][]): { label: string; col: number }[] {
  if (rows.length === 0 || rows[0]!.length === 0) return [];
  const firstRow = rows[0]!;
  const labels: { label: string; col: number }[] = [];
  let lastMonth = -1;

  for (let col = 0; col < firstRow.length; col++) {
    const month = firstRow[col]!.date.getMonth();
    if (month !== lastMonth) {
      labels.push({ label: MONTH_LABELS[month]!, col });
      lastMonth = month;
    }
  }

  return labels;
}

function HeatmapCellWithTooltip({ cell }: { cell: HeatmapCell }) {
  if (cell.data) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            data-testid="heatmap-cell-trigger"
            className={`h-3 w-3 rounded-sm cursor-pointer ${INTENSITY_CLASSES[cell.level]}`}
          />
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-0.5">
            <p className="font-medium">{formatCellDate(cell.date)}</p>
            <p>{cell.data.ticketsShipped} ticket{cell.data.ticketsShipped !== 1 ? 's' : ''} shipped</p>
            <p>
              {cell.data.jobCount} job{cell.data.jobCount !== 1 ? 's' : ''}
              {cell.data.costUsd != null && ` · ${formatCost(cell.data.costUsd)}`}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-testid="heatmap-cell-empty"
          className={`h-3 w-3 rounded-sm ${INTENSITY_CLASSES[0]}`}
        />
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs">
          <p className="font-medium">{formatCellDate(cell.date)}</p>
          <p>No activity</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ActivityHeatmap() {
  const [filters, setFilters] = useState<HeatmapFilters>({
    year: 'rolling',
    agent: 'all',
  });

  const { data, isLoading } = useActivityHeatmap(filters);

  const grid = useMemo(() => {
    if (!data) return [];
    return buildGrid(data.days, data.period.start, data.period.end);
  }, [data]);

  const monthLabels = useMemo(() => getMonthLabels(grid), [grid]);

  const totalJobs = data?.totalJobs ?? 0;
  const totalTicketsShipped = data?.totalTicketsShipped ?? 0;

  return (
    <Card className="border-ctp-mauve/15 aurora-bg-subtle mt-6">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-muted-foreground" data-testid="heatmap-metrics">
            <span className="font-medium text-foreground">{totalJobs} jobs</span>
            {' · '}
            <span className="font-medium text-foreground">{totalTicketsShipped} tickets shipped</span>
            {' in the last year'}
          </p>
          <div className="flex items-center gap-2" data-testid="heatmap-controls">
            {/* Year selector (US3) */}
            <Select
              value={String(filters.year)}
              onValueChange={(value) => {
                const year = value === 'rolling' ? 'rolling' : Number(value);
                setFilters((prev) => ({ ...prev, year }));
              }}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs" data-testid="year-selector">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rolling">Last 12 months</SelectItem>
                {(data?.availableYears ?? []).map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Agent filter (US4) */}
            <Select
              value={filters.agent}
              onValueChange={(value) => {
                setFilters((prev) => ({ ...prev, agent: value as HeatmapFilters['agent'] }));
              }}
            >
              <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="agent-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(data?.availableAgents ?? []).map((agent) => (
                  <SelectItem key={agent.value} value={agent.value}>
                    {agent.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">Loading activity...</p>
          </div>
        ) : (
          <TooltipProvider>
            <div data-testid="heatmap-scroll-container" className="overflow-x-auto">
              <div className="min-w-[720px]">
                {/* Month labels */}
                <div className="flex ml-8 mb-1">
                  {monthLabels.map(({ label, col }) => (
                    <span
                      key={`${label}-${col}`}
                      className="text-xs text-muted-foreground"
                      style={{
                        position: 'relative',
                        left: `${col * 14}px`,
                        marginRight: '-14px',
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>

                {/* Grid */}
                <div className="flex gap-0.5" data-testid="heatmap-grid">
                  {/* Day-of-week labels */}
                  <div className="flex flex-col gap-0.5 mr-1 shrink-0">
                    {DAY_LABELS.map((label, i) => (
                      <div
                        key={label}
                        className="h-3 w-6 text-xs text-muted-foreground flex items-center justify-end"
                      >
                        {i % 2 === 1 ? label : ''}
                      </div>
                    ))}
                  </div>

                  {/* Week columns */}
                  {grid.length > 0 &&
                    Array.from({ length: grid[0]!.length }, (_, col) => (
                      <div key={col} className="flex flex-col gap-0.5" data-testid="heatmap-column">
                        {grid.map((row, rowIdx) => {
                          const cell = row[col]!;
                          return (
                            <HeatmapCellWithTooltip key={rowIdx} cell={cell} />
                          );
                        })}
                      </div>
                    ))}
                </div>

                {/* Legend */}
                <div
                  className="flex items-center justify-end gap-1 mt-2"
                  data-testid="heatmap-legend"
                >
                  <span className="text-xs text-muted-foreground mr-1">Less</span>
                  {INTENSITY_CLASSES.map((cls, i) => (
                    <div
                      key={i}
                      data-testid="legend-cell"
                      className={`h-3 w-3 rounded-sm ${cls}`}
                    />
                  ))}
                  <span className="text-xs text-muted-foreground ml-1">More</span>
                </div>
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

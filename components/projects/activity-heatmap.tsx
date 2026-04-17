'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Agent } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { AGENT_LABELS } from '@/app/lib/utils/agent-resolution';
import type {
  HeatmapResponse,
  HeatmapDayCell,
} from '@/lib/analytics/activity-heatmap';

interface ActivityHeatmapProps {
  initialData: HeatmapResponse | null;
  errored: boolean;
}

const INTENSITY_CLASSES: Readonly<Record<0 | 1 | 2 | 3 | 4, string>> = Object.freeze({
  0: 'aurora-heatmap-cell-empty',
  1: 'aurora-heatmap-cell-1',
  2: 'aurora-heatmap-cell-2',
  3: 'aurora-heatmap-cell-3',
  4: 'aurora-heatmap-cell-4',
});

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function parseISODay(iso: string): { y: number; m: number; d: number; weekday: number } {
  const parts = iso.split('-');
  const y = parseInt(parts[0] ?? '1970', 10);
  const m = parseInt(parts[1] ?? '1', 10);
  const d = parseInt(parts[2] ?? '1', 10);
  const utc = new Date(Date.UTC(y, m - 1, d));
  return { y, m, d, weekday: utc.getUTCDay() };
}

function formatLongDate(iso: string): string {
  const { y, m, d } = parseISODay(iso);
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

interface WeekColumn {
  cells: (HeatmapDayCell | null)[];
  monthLabel: string | null;
}

function buildWeeks(cells: HeatmapDayCell[]): WeekColumn[] {
  if (cells.length === 0) return [];
  const weeks: WeekColumn[] = [];
  let currentCol: (HeatmapDayCell | null)[] = new Array(7).fill(null);
  let firstCellInCol: HeatmapDayCell | null = null;
  const firstDayInfo = parseISODay(cells[0]!.date);
  for (let i = 0; i < firstDayInfo.weekday; i++) {
    currentCol[i] = null;
  }

  let currentMonth = -1;

  for (const cell of cells) {
    const info = parseISODay(cell.date);
    if (info.weekday === 0 && currentCol.some((c) => c !== null)) {
      weeks.push({
        cells: currentCol,
        monthLabel: firstCellInCol ? monthLabelForColumn(firstCellInCol, currentMonth) : null,
      });
      if (firstCellInCol) {
        const m = parseISODay(firstCellInCol.date).m;
        if (m !== currentMonth) currentMonth = m;
      }
      currentCol = new Array(7).fill(null);
      firstCellInCol = null;
    }
    currentCol[info.weekday] = cell;
    if (firstCellInCol === null) firstCellInCol = cell;
  }
  if (currentCol.some((c) => c !== null)) {
    weeks.push({
      cells: currentCol,
      monthLabel: firstCellInCol ? monthLabelForColumn(firstCellInCol, currentMonth) : null,
    });
  }
  return weeks;
}

function monthLabelForColumn(firstCell: HeatmapDayCell, previousMonth: number): string | null {
  const info = parseISODay(firstCell.date);
  if (info.m !== previousMonth) {
    return MONTH_NAMES[info.m - 1] ?? null;
  }
  return null;
}

async function fetchHeatmap(
  y: string,
  a: string,
  tz: string
): Promise<HeatmapResponse> {
  const params = new URLSearchParams();
  if (y !== '12m') params.set('y', y);
  if (a !== 'all') params.set('a', a);
  if (tz) params.set('tz', tz);
  const url = `/api/activity-heatmap${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to fetch activity heatmap');
  }
  return response.json();
}

function periodPhrase(data: HeatmapResponse): string {
  if (data.period.kind === 'calendarYear' && data.period.year !== undefined) {
    return `in ${data.period.year}`;
  }
  return 'in the last year';
}

function formatCost(cost: number): string {
  if (!Number.isFinite(cost)) return '';
  return `$${cost.toFixed(2)}`;
}

function resolveBrowserTimezone(): string {
  if (typeof Intl === 'undefined') return 'UTC';
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function ActivityHeatmap({ initialData, errored }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialY = searchParams?.get('y') || '12m';
  const initialA = searchParams?.get('a') || 'all';
  const [y, setY] = useState<string>(initialY);
  const [a, setA] = useState<string>(initialA);
  const [tz] = useState<string>(
    () => resolveBrowserTimezone() || initialData?.period.timezone || 'UTC'
  );

  const isDefaultFilters =
    y === (initialData?.period.kind === 'rolling12m' ? '12m' : String(initialData?.period.year ?? '12m')) &&
    a === 'all' &&
    tz === (initialData?.period.timezone ?? 'UTC');

  const seededInitial = isDefaultFilters && initialData ? initialData : null;

  const { data } = useQuery<HeatmapResponse>({
    queryKey: ['activity-heatmap', y, a, tz],
    queryFn: () => fetchHeatmap(y, a, tz),
    ...(seededInitial ? { initialData: seededInitial } : {}),
    staleTime: 15000,
  });

  const heatmap: HeatmapResponse | null = (data as HeatmapResponse | undefined) ?? initialData;

  const updateFilters = useCallback(
    (next: { y?: string; a?: string }) => {
      const nextY = next.y ?? y;
      const nextA = next.a ?? a;
      setY(nextY);
      setA(nextA);
      const params = new URLSearchParams();
      if (nextY !== '12m') params.set('y', nextY);
      if (nextA !== 'all') params.set('a', nextA);
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [y, a, router]
  );

  const weeks = useMemo(() => (heatmap ? buildWeeks(heatmap.cells) : []), [heatmap]);

  if (errored || !heatmap) {
    return (
      <Card className="border-ctp-mauve/15 aurora-bg-subtle mt-8">
        <CardHeader>
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-ctp-subtext0">
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" role="alert">
            Activity heatmap is temporarily unavailable. The rest of your projects page is still
            accessible.
          </p>
        </CardContent>
      </Card>
    );
  }

  const phrase = periodPhrase(heatmap);
  const counter = `${heatmap.counters.jobCount} jobs · ${heatmap.counters.shippedTicketCount} tickets shipped ${phrase}`;
  const hasActivity = heatmap.counters.jobCount > 0;
  const showYearSelector = heatmap.yearSelector.calendarYears.length > 0;
  const showAgentFilter = heatmap.availableAgents.length >= 2;

  return (
    <Card className="border-ctp-mauve/15 aurora-bg-subtle mt-8" data-testid="activity-heatmap">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-ctp-subtext0">
            Activity
          </CardTitle>
          <p
            className="text-sm font-medium text-foreground"
            data-testid="activity-heatmap-counter"
          >
            {counter}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showYearSelector && (
            <Select
              value={y}
              onValueChange={(value) => updateFilters({ y: value })}
            >
              <SelectTrigger
                className="w-[170px]"
                data-testid="activity-heatmap-year-filter"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12m">Last 12 months</SelectItem>
                {heatmap.yearSelector.calendarYears.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showAgentFilter && (
            <Select
              value={a}
              onValueChange={(value) => updateFilters({ a: value })}
            >
              <SelectTrigger
                className="w-[150px]"
                data-testid="activity-heatmap-agent-filter"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {heatmap.availableAgents.map((agent) => (
                  <SelectItem key={agent} value={agent}>
                    {AGENT_LABELS[agent as keyof typeof AGENT_LABELS] ?? agent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasActivity ? (
          <div
            className="flex min-h-[120px] items-center justify-center text-sm text-muted-foreground"
            data-testid="activity-heatmap-empty"
          >
            No activity to show yet — your AI work will appear here.
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <TooltipProvider delayDuration={150}>
            <div className="flex">
              <div
                className="sticky left-0 z-10 flex flex-col aurora-bg-subtle pr-2"
                data-testid="activity-heatmap-day-labels"
              >
                <div className="h-5" aria-hidden />
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={label}
                    className="flex h-3 items-center text-[10px] text-muted-foreground"
                    style={{ visibility: i % 2 === 1 ? 'visible' : 'hidden' }}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <div className="flex flex-col">
                <div className="flex h-5">
                  {weeks.map((week, idx) => (
                    <div
                      key={idx}
                      className="w-3 text-[10px] text-muted-foreground"
                    >
                      {week.monthLabel}
                    </div>
                  ))}
                </div>
                <div className="flex gap-[2px]">
                  {weeks.map((week, idx) => (
                    <div key={idx} className="flex flex-col gap-[2px]">
                      {week.cells.map((cell, rowIdx) => (
                        <HeatmapCell
                          key={rowIdx}
                          cell={cell}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TooltipProvider>
        </div>

        <div
          className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground"
          data-testid="activity-heatmap-legend"
        >
          <span>Less</span>
          <span
            className="inline-block h-3 w-3 rounded-sm aurora-heatmap-cell-empty"
            aria-hidden
          />
          <span
            className="inline-block h-3 w-3 rounded-sm aurora-heatmap-cell-1"
            aria-hidden
          />
          <span
            className="inline-block h-3 w-3 rounded-sm aurora-heatmap-cell-2"
            aria-hidden
          />
          <span
            className="inline-block h-3 w-3 rounded-sm aurora-heatmap-cell-3"
            aria-hidden
          />
          <span
            className="inline-block h-3 w-3 rounded-sm aurora-heatmap-cell-4"
            aria-hidden
          />
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

function HeatmapCell({ cell }: { cell: HeatmapDayCell | null }) {
  if (!cell) {
    return <div className="h-3 w-3" aria-hidden />;
  }
  const tooltip = renderTooltip(cell);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`h-3 w-3 cursor-pointer rounded-sm ${INTENSITY_CLASSES[cell.intensity]}`}
          data-testid="heatmap-cell"
          data-date={cell.date}
          data-intensity={cell.intensity}
          data-job-count={cell.jobCount}
          role="gridcell"
          tabIndex={0}
          aria-label={`${cell.date}: ${cell.jobCount} jobs`}
        />
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1 text-xs">{tooltip}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function renderTooltip(cell: HeatmapDayCell) {
  const dateLabel = formatLongDate(cell.date);

  if (cell.jobCount === 0 && cell.shippedTickets.length === 0) {
    return (
      <>
        <div className="font-medium text-foreground">{dateLabel}</div>
        <div className="text-muted-foreground">No activity</div>
      </>
    );
  }

  const namedTickets = cell.shippedTickets.filter((t) => t.title !== null);
  const deletedCount = cell.shippedTickets.length - namedTickets.length;

  const jobsLine = cell.costUsd === null
    ? `${cell.jobCount} ${cell.jobCount === 1 ? 'job' : 'jobs'}`
    : `${cell.jobCount} ${cell.jobCount === 1 ? 'job' : 'jobs'} · ${formatCost(cell.costUsd)}`;

  return (
    <>
      <div className="font-medium text-foreground">{dateLabel}</div>
      {namedTickets.length > 0 && (
        <div data-testid="heatmap-cell-tickets">
          {namedTickets.length === 1
            ? `1 ticket shipped: ${namedTickets[0]!.title}`
            : `${namedTickets.length} tickets shipped: ${namedTickets.map((t) => t.title).join(', ')}`}
        </div>
      )}
      {deletedCount > 0 && (
        <div className="text-muted-foreground">
          {deletedCount === 1 ? '1 more ticket' : `${deletedCount} more tickets`}
        </div>
      )}
      <div data-testid="heatmap-cell-jobs">{jobsLine}</div>
    </>
  );
}

export type { Agent };

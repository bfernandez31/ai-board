'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AGENT_FILTER_VALUES } from '@/lib/analytics/types';
import type { AgentFilter } from '@/lib/analytics/types';
import type { HeatmapData, HeatmapDayData, HeatmapFilters } from '@/lib/heatmap/types';

// ── Constants ───────────────────────────────────────────────────────
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const CELL_SIZE = 13;
const CELL_GAP = 3;
const LABEL_WIDTH = 32;

// Violet gradient color scale (aurora theme)
const INTENSITY_COLORS = [
  'bg-zinc-800/50',                              // level 0 - empty
  'bg-violet-900/60',                            // level 1
  'bg-violet-700/70',                            // level 2
  'bg-violet-500/80',                            // level 3
  'bg-violet-400',                               // level 4
] as const;

// ── Helpers ─────────────────────────────────────────────────────────
function getIntensityLevel(count: number, max: number): number {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

interface WeekColumn {
  /** ISO date strings for each row (Sun=0..Sat=6), null if outside period */
  days: (string | null)[];
  /** Month index (0-11) for the first valid day in this column */
  month: number;
}

function buildWeekColumns(startDate: Date, endDate: Date): WeekColumn[] {
  const columns: WeekColumn[] = [];
  const current = new Date(startDate);

  // Rewind to the Sunday of the week containing startDate
  const startDow = current.getDay();
  const weekStart = new Date(current);
  weekStart.setDate(weekStart.getDate() - startDow);

  const cursor = new Date(weekStart);

  while (cursor <= endDate || cursor.getDay() !== 0) {
    const week: (string | null)[] = [];
    let firstMonth = -1;

    for (let dow = 0; dow < 7; dow++) {
      if (cursor >= startDate && cursor <= endDate) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, '0');
        const d = String(cursor.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        week.push(key);
        if (firstMonth === -1) firstMonth = cursor.getMonth();
      } else {
        week.push(null);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // Only add the column if it has at least one valid day
    if (week.some((d) => d !== null)) {
      if (firstMonth === -1) firstMonth = 0;
      columns.push({ days: week, month: firstMonth });
    }

    // Stop after we've passed the end date and completed the week
    if (cursor > endDate && cursor.getDay() === 0) break;
  }

  return columns;
}

function getDateRange(year: string): { start: Date; end: Date } {
  if (year === 'rolling') {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
    return { start, end };
  }
  const y = parseInt(year, 10);
  return {
    start: new Date(y, 0, 1),
    end: new Date(y, 11, 31),
  };
}

async function fetchHeatmapData(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams({
    year: filters.year,
    agent: filters.agent,
  });
  const res = await fetch(`/api/heatmap?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch heatmap data');
  return res.json();
}

// ── Tooltip Component ───────────────────────────────────────────────
function HeatmapTooltip({
  dateStr,
  dayData,
  position,
  onClose,
}: {
  dateStr: string;
  dayData: HeatmapDayData | undefined;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const jobs = dayData?.jobCount ?? 0;
  const shipped = dayData?.ticketsShipped ?? [];
  const cost = dayData?.costUsd;

  return (
    <>
      {/* Mobile: tap outside to dismiss */}
      <div
        className="fixed inset-0 z-40 md:hidden"
        onClick={onClose}
        onTouchStart={onClose}
      />
      <div
        className="fixed z-50 rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -100%) translateY(-8px)',
          pointerEvents: 'none',
        }}
      >
        <p className="font-medium">{formatDate(dateStr)}</p>
        <p className="mt-1 text-muted-foreground">
          {jobs} {jobs === 1 ? 'job' : 'jobs'}
        </p>
        {cost != null && cost > 0 && (
          <p className="text-muted-foreground">{formatCost(cost)}</p>
        )}
        {shipped.length > 0 && (
          <p className="mt-1 text-violet-400">
            {shipped.length} {shipped.length === 1 ? 'ticket' : 'tickets'} shipped
          </p>
        )}
      </div>
    </>
  );
}

// ── Legend Component ─────────────────────────────────────────────────
function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span>Less</span>
      {INTENSITY_COLORS.map((color, i) => (
        <div
          key={i}
          className={`rounded-sm ${color}`}
          style={{ width: CELL_SIZE, height: CELL_SIZE }}
        />
      ))}
      <span>More</span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────
interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filters from URL params, falling back to initial data
  const [filters, setFilters] = useState<HeatmapFilters>(() => {
    const agentParam = searchParams.get('heatmap_agent');
    const agent: AgentFilter =
      agentParam && AGENT_FILTER_VALUES.includes(agentParam as AgentFilter)
        ? (agentParam as AgentFilter)
        : initialData.filters.agent;
    return {
      year: searchParams.get('heatmap_year') ?? initialData.filters.year,
      agent,
    };
  });

  const filtersMatchInitial =
    filters.year === initialData.filters.year &&
    filters.agent === initialData.filters.agent;

  const { data } = useQuery({
    queryKey: queryKeys.heatmap.data(filters.year, filters.agent),
    queryFn: () => fetchHeatmapData(filters),
    initialData: filtersMatchInitial ? initialData : undefined,
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const heatmapData = data ?? initialData;

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    dateStr: string;
    dayData: HeatmapDayData | undefined;
    position: { x: number; y: number };
  } | null>(null);

  const updateFilters = useCallback(
    (next: HeatmapFilters) => {
      setFilters(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next.year === 'rolling') {
        params.delete('heatmap_year');
      } else {
        params.set('heatmap_year', next.year);
      }
      if (next.agent === 'all') {
        params.delete('heatmap_agent');
      } else {
        params.set('heatmap_agent', next.agent);
      }
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  // Build the grid
  const { start, end } = useMemo(() => getDateRange(filters.year), [filters.year]);
  const columns = useMemo(() => buildWeekColumns(start, end), [start, end]);

  const maxJobCount = useMemo(() => {
    let max = 0;
    for (const day of Object.values(heatmapData.days)) {
      if (day.jobCount > max) max = day.jobCount;
    }
    return max;
  }, [heatmapData.days]);

  const hasActivity = heatmapData.summary.totalJobs > 0;

  // Month labels positioned above their starting column
  const monthLabels = useMemo(() => {
    const labels: { month: number; colIndex: number }[] = [];
    let lastMonth = -1;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!;
      if (col.month !== lastMonth) {
        labels.push({ month: col.month, colIndex: i });
        lastMonth = col.month;
      }
    }
    return labels;
  }, [columns]);

  const handleCellInteraction = useCallback(
    (dateStr: string, dayData: HeatmapDayData | undefined, rect: DOMRect) => {
      setTooltip({
        dateStr,
        dayData,
        position: {
          x: rect.left + rect.width / 2,
          y: rect.top,
        },
      });
    },
    []
  );

  const yearLabel = filters.year === 'rolling' ? 'the last year' : filters.year;
  const showAgentFilter = heatmapData.availableAgents.length > 2; // "All" + at least 2 agents
  const showYearSelector =
    heatmapData.availableYears.length > 0 &&
    !(heatmapData.availableYears.length === 1 &&
      heatmapData.availableYears[0] === new Date().getFullYear());

  return (
    <div className="aurora-bg-section rounded-xl border border-border p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Activity</h2>
          <p className="text-sm text-muted-foreground">
            {heatmapData.summary.totalJobs.toLocaleString()}{' '}
            {heatmapData.summary.totalJobs === 1 ? 'job' : 'jobs'} &middot;{' '}
            {heatmapData.summary.ticketsShipped.toLocaleString()}{' '}
            {heatmapData.summary.ticketsShipped === 1 ? 'ticket' : 'tickets'} shipped in{' '}
            {yearLabel}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {showAgentFilter && (
            <Select
              value={filters.agent}
              onValueChange={(val) => updateFilters({ ...filters, agent: val as AgentFilter })}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {heatmapData.availableAgents.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {showYearSelector && (
            <Select
              value={filters.year}
              onValueChange={(val) => updateFilters({ ...filters, year: val })}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rolling">Last 12 months</SelectItem>
                {heatmapData.availableYears.map((yr) => (
                  <SelectItem key={yr} value={String(yr)}>
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Grid or Empty State */}
      {hasActivity ? (
        <div className="relative">
          {/* Scrollable container for mobile */}
          <div ref={scrollRef} className="overflow-x-auto pb-2">
            <div
              className="relative"
              style={{
                minWidth: columns.length * (CELL_SIZE + CELL_GAP) + LABEL_WIDTH + 16,
              }}
            >
              {/* Month labels */}
              <div className="flex text-xs text-muted-foreground" style={{ paddingLeft: LABEL_WIDTH }}>
                {monthLabels.map(({ month, colIndex }, i) => (
                  <span
                    key={`${month}-${i}`}
                    className="truncate"
                    style={{
                      position: 'absolute',
                      left: LABEL_WIDTH + colIndex * (CELL_SIZE + CELL_GAP),
                    }}
                  >
                    {MONTH_LABELS[month]}
                  </span>
                ))}
              </div>

              {/* Grid with day labels */}
              <div className="mt-5 flex">
                {/* Day-of-week labels (sticky on mobile) */}
                <div
                  className="sticky left-0 z-10 flex-shrink-0 bg-inherit"
                  style={{ width: LABEL_WIDTH }}
                >
                  {DAY_LABELS.map((label, i) => (
                    <div
                      key={label}
                      className="text-xs text-muted-foreground"
                      style={{
                        height: CELL_SIZE + CELL_GAP,
                        lineHeight: `${CELL_SIZE + CELL_GAP}px`,
                        visibility: i % 2 === 1 ? 'visible' : 'hidden',
                      }}
                    >
                      {label}
                    </div>
                  ))}
                </div>

                {/* Week columns */}
                <div className="flex gap-px">
                  {columns.map((col, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-px">
                      {col.days.map((dateStr, rowIdx) => {
                        if (dateStr === null) {
                          return (
                            <div
                              key={rowIdx}
                              style={{ width: CELL_SIZE, height: CELL_SIZE, marginBottom: CELL_GAP - 1 }}
                            />
                          );
                        }

                        const dayData = heatmapData.days[dateStr];
                        const level = getIntensityLevel(dayData?.jobCount ?? 0, maxJobCount);

                        return (
                          <div
                            key={dateStr}
                            className={`rounded-sm ${INTENSITY_COLORS[level]} cursor-pointer transition-colors hover:ring-1 hover:ring-violet-400/50`}
                            style={{ width: CELL_SIZE, height: CELL_SIZE, marginBottom: CELL_GAP - 1 }}
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              handleCellInteraction(dateStr, dayData, rect);
                            }}
                            onMouseLeave={() => setTooltip(null)}
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              handleCellInteraction(dateStr, dayData, rect);
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            No activity to show yet — your AI work will appear here
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 flex justify-end">
        <HeatmapLegend />
      </div>

      {/* Tooltip */}
      {tooltip && (
        <HeatmapTooltip
          dateStr={tooltip.dateStr}
          dayData={tooltip.dayData}
          position={tooltip.position}
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  );
}

'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHeatmap } from '@/app/lib/hooks/queries/use-heatmap';
import type { HeatmapData, HeatmapDayData } from '@/lib/heatmap/types';
import { DEFAULT_HEATMAP_PERIOD } from '@/lib/heatmap/types';
import { formatCost } from '@/lib/analytics/aggregations';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getIntensityLevel(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 0) return 1;
  const ratio = count / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

const INTENSITY_CLASSES = [
  'aurora-heatmap-0',
  'aurora-heatmap-1',
  'aurora-heatmap-2',
  'aurora-heatmap-3',
  'aurora-heatmap-4',
] as const;

interface WeekColumn {
  days: (string | null)[];
  monthLabel?: string;
}

function buildGrid(periodStart: string, periodEnd: string): WeekColumn[] {
  const start = new Date(periodStart + 'T00:00:00');
  const end = new Date(periodEnd + 'T00:00:00');
  const columns: WeekColumn[] = [];
  let currentWeek: (string | null)[] = [];

  for (let i = 0; i < start.getDay(); i++) {
    currentWeek.push(null);
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getDay() === 0 && currentWeek.length > 0) {
      columns.push({ days: currentWeek });
      currentWeek = [];
    }

    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    currentWeek.push(`${y}-${m}-${d}`);

    cursor.setDate(cursor.getDate() + 1);
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    columns.push({ days: currentWeek });
  }

  let prevMonth = -1;
  for (const col of columns) {
    const firstDay = col.days.find((day): day is string => day !== null);
    if (!firstDay) continue;
    const month = parseInt(firstDay.split('-')[1]!, 10) - 1;
    if (month !== prevMonth) {
      col.monthLabel = MONTH_LABELS[month] ?? '';
      prevMonth = month;
    }
  }

  return columns;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildYearOptions(userCreatedAt: string): string[] {
  const createdYear = new Date(userCreatedAt).getFullYear();
  const currentYear = new Date().getFullYear();
  if (createdYear >= currentYear) return [];
  const years: string[] = [];
  for (let y = currentYear; y >= createdYear; y--) {
    years.push(String(y));
  }
  return years;
}

interface TooltipInfo {
  x: number;
  y: number;
  day: HeatmapDayData;
  dateLabel: string;
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const period = searchParams.get('heatmap_period') ?? DEFAULT_HEATMAP_PERIOD;
  const agent = searchParams.get('heatmap_agent') ?? 'all';

  const { data } = useHeatmap({ period, agent, initialData });
  const heatmap = data ?? initialData;

  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updateParams = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (
        (key === 'heatmap_period' && value === DEFAULT_HEATMAP_PERIOD) ||
        (key === 'heatmap_agent' && value === 'all')
      ) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.push(qs ? `?${qs}` : '/projects', { scroll: false });
    },
    [router, searchParams]
  );

  const columns = useMemo(
    () => buildGrid(heatmap.periodStart, heatmap.periodEnd),
    [heatmap.periodStart, heatmap.periodEnd]
  );

  const maxJobCount = useMemo(() => {
    let max = 0;
    for (const day of Object.values(heatmap.days)) {
      if (day.jobCount > max) max = day.jobCount;
    }
    return max;
  }, [heatmap.days]);

  const yearOptions = useMemo(
    () => buildYearOptions(heatmap.userCreatedAt),
    [heatmap.userCreatedAt]
  );

  const hasActivity = heatmap.totalJobs > 0;

  const showYearSelector = yearOptions.length > 0;

  const handleCellInteraction = useCallback(
    (dateKey: string, event: React.MouseEvent | React.TouchEvent) => {
      event.preventDefault();
      const gridRect = gridRef.current?.getBoundingClientRect();
      if (!gridRect) return;

      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const dayData = heatmap.days[dateKey];

      setTooltip({
        x: rect.left - gridRect.left + rect.width / 2,
        y: rect.top - gridRect.top,
        day: dayData ?? { date: dateKey, jobCount: 0, costUsd: null, shippedTickets: [] },
        dateLabel: formatDateLabel(dateKey),
      });
    },
    [heatmap.days]
  );

  useEffect(() => {
    if (!tooltip) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setTooltip(null);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [tooltip]);

  const periodLabel = period === DEFAULT_HEATMAP_PERIOD
    ? 'the last year'
    : period;

  return (
    <Card className="aurora-bg-subtle" data-testid="activity-heatmap">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">Activity</h2>
            <span className="text-sm text-muted-foreground" data-testid="heatmap-summary">
              {heatmap.totalJobs.toLocaleString()} job{heatmap.totalJobs !== 1 ? 's' : ''} · {heatmap.totalShipped.toLocaleString()} ticket{heatmap.totalShipped !== 1 ? 's' : ''} shipped in {periodLabel}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {heatmap.availableAgents.length > 0 && (
              <Select
                value={agent}
                onValueChange={(v) => updateParams('heatmap_agent', v)}
              >
                <SelectTrigger
                  className="w-[140px] h-8 text-xs"
                  data-testid="heatmap-agent-filter"
                >
                  <SelectValue placeholder="Agent" />
                </SelectTrigger>
                <SelectContent>
                  {heatmap.availableAgents.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {showYearSelector ? (
              <Select
                value={period}
                onValueChange={(v) => updateParams('heatmap_period', v)}
              >
                <SelectTrigger
                  className="w-[160px] h-8 text-xs"
                  data-testid="heatmap-period-selector"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_HEATMAP_PERIOD}>Last 12 months</SelectItem>
                  {yearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-xs text-muted-foreground px-2">Last 12 months</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!hasActivity ? (
          <div
            className="flex items-center justify-center py-16 text-muted-foreground text-sm"
            data-testid="heatmap-empty-state"
          >
            No activity to show yet — your AI work will appear here
          </div>
        ) : (
          <div className="relative" ref={gridRef}>
            <div className="overflow-x-auto">
              <div className="inline-flex">
                {/* Day-of-week labels */}
                <div className="sticky left-0 z-10 bg-card pr-2 flex flex-col" style={{ paddingTop: '18px' }}>
                  {DAY_LABELS.map((label, i) => (
                    <div
                      key={label}
                      className="h-[13px] text-[10px] leading-[13px] text-muted-foreground"
                      style={{ marginBottom: i < 6 ? '2px' : 0 }}
                    >
                      {i % 2 === 1 ? label : ''}
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div>
                  {/* Month labels */}
                  <div className="flex" style={{ height: '16px' }}>
                    {columns.map((col, ci) => (
                      <div
                        key={ci}
                        className="text-[10px] text-muted-foreground"
                        style={{ width: '15px', minWidth: '15px' }}
                      >
                        {col.monthLabel ?? ''}
                      </div>
                    ))}
                  </div>

                  {/* Cells grid: 7 rows x N columns */}
                  <div className="flex">
                    {columns.map((col, ci) => (
                      <div key={ci} className="flex flex-col" style={{ width: '15px', minWidth: '15px' }}>
                        {col.days.map((dateKey, ri) => {
                          if (!dateKey) {
                            return (
                              <div
                                key={`empty-${ri}`}
                                style={{ width: '13px', height: '13px', margin: '1px' }}
                              />
                            );
                          }
                          const dayData = heatmap.days[dateKey];
                          const count = dayData?.jobCount ?? 0;
                          const level = getIntensityLevel(count, maxJobCount);
                          return (
                            <div
                              key={dateKey}
                              className={`rounded-sm cursor-pointer ${INTENSITY_CLASSES[level]}`}
                              style={{ width: '13px', height: '13px', margin: '1px' }}
                              data-testid="heatmap-cell"
                              data-date={dateKey}
                              data-count={count}
                              onMouseEnter={(e) => handleCellInteraction(dateKey, e)}
                              onMouseLeave={() => setTooltip(null)}
                              onTouchStart={(e) => handleCellInteraction(dateKey, e)}
                              role="gridcell"
                              aria-label={`${count} job${count !== 1 ? 's' : ''} on ${dateKey}`}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div
                ref={tooltipRef}
                className="absolute z-20 pointer-events-none bg-popover text-popover-foreground border rounded-md shadow-lg px-3 py-2 text-xs"
                style={{
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y - 8}px`,
                  transform: 'translate(-50%, -100%)',
                  minWidth: '180px',
                }}
                data-testid="heatmap-tooltip"
              >
                <p className="font-medium">{tooltip.dateLabel}</p>
                <p className="text-muted-foreground mt-1">
                  {tooltip.day.jobCount} job{tooltip.day.jobCount !== 1 ? 's' : ''}
                  {tooltip.day.costUsd != null && ` · ${formatCost(tooltip.day.costUsd)}`}
                </p>
                {tooltip.day.shippedTickets.length > 0 && (
                  <div className="mt-1 border-t border-border pt-1">
                    <p className="text-muted-foreground font-medium">Shipped:</p>
                    {tooltip.day.shippedTickets.map((ticket) => (
                      <p key={ticket} className="text-muted-foreground truncate max-w-[250px]">
                        {ticket}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 mt-3 text-[10px] text-muted-foreground">
          <span>Less</span>
          {INTENSITY_CLASSES.map((cls, i) => (
            <div
              key={i}
              className={`rounded-sm ${cls}`}
              style={{ width: '11px', height: '11px' }}
              data-testid="heatmap-legend-cell"
            />
          ))}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

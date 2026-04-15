'use client';

import { useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useHeatmap } from '@/app/lib/hooks/queries/use-heatmap';
import { HeatmapGrid } from './heatmap-grid';
import { HeatmapTooltip } from './heatmap-tooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HeatmapData, HeatmapDay } from '@/lib/heatmap/types';
import { computeQuartiles, getIntensityLevel } from '@/lib/heatmap/queries';
import { formatDateKey } from './heatmap-grid';

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

function getDateRange(year: string): { start: Date; end: Date } {
  const now = new Date();
  if (year === 'rolling') {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 364);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
  }
  const y = parseInt(year, 10);
  return {
    start: new Date(Date.UTC(y, 0, 1)),
    end: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)),
  };
}

const INTENSITY_LEVELS = [0, 1, 2, 3, 4] as const;

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const year = searchParams.get('year') ?? 'rolling';
  const agent = searchParams.get('agent') ?? 'all';

  const { data } = useHeatmap(initialData, { year, agent });
  const heatmapData = data ?? initialData;

  const currentYear = new Date().getUTCFullYear();
  const showYearSelector = heatmapData.userCreatedYear < currentYear;
  const showAgentFilter = heatmapData.agents.length > 2;

  const { start, end } = useMemo(() => getDateRange(year), [year]);

  const yearOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [
      { value: 'rolling', label: 'Last 12 months' },
    ];
    for (let y = currentYear; y >= heatmapData.userCreatedYear; y--) {
      options.push({ value: String(y), label: String(y) });
    }
    return options;
  }, [currentYear, heatmapData.userCreatedYear]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if ((key === 'year' && value === 'rolling') || (key === 'agent' && value === 'all')) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '/projects', { scroll: false });
  };

  // Build day lookup and quartiles for tooltip rendering
  const dayMap = useMemo(() => {
    const map = new Map<string, HeatmapDay>();
    for (const day of heatmapData.days) {
      map.set(day.date, day);
    }
    return map;
  }, [heatmapData.days]);

  const quartiles = useMemo(
    () => computeQuartiles(heatmapData.days.map((d) => d.jobCount)),
    [heatmapData.days]
  );

  if (heatmapData.totalJobs === 0 && !showYearSelector && !showAgentFilter) {
    return (
      <div className="aurora-bg-section rounded-lg border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Activity</h2>
        <p className="text-sm text-muted-foreground">
          No activity to show yet — your AI work will appear here
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="aurora-bg-section rounded-lg border border-border p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Activity</h2>
            <p className="text-sm text-muted-foreground">
              {heatmapData.totalJobs} jobs &middot; {heatmapData.totalShipped} tickets shipped {heatmapData.periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showAgentFilter && (
              <Select value={agent} onValueChange={(v) => updateParam('agent', v)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {heatmapData.agents.map((a) => (
                    <SelectItem key={a.value} value={a.value} className="text-xs">
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {showYearSelector && (
              <Select value={year} onValueChange={(v) => updateParam('year', v)}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Heatmap Grid */}
        {heatmapData.totalJobs === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No activity to show yet — your AI work will appear here
          </p>
        ) : (
          <>
            <HeatmapGrid
              days={heatmapData.days}
              startDate={start}
              endDate={end}
              renderTooltip={(dayData, cellDate) => {
                const dateKey = formatDateKey(cellDate);
                const resolvedDay = dayData ?? dayMap.get(dateKey) ?? null;
                const level = resolvedDay ? getIntensityLevel(resolvedDay.jobCount, quartiles) : 0;
                return (
                  <HeatmapTooltip key={dateKey} day={resolvedDay} date={cellDate} level={level} />
                );
              }}
            />

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 mt-3" aria-hidden="true">
              <span className="text-[10px] text-muted-foreground mr-1">Less</span>
              {INTENSITY_LEVELS.map((level) => (
                <div
                  key={level}
                  className={`heatmap-level-${level} rounded-sm`}
                  style={{ width: '12px', height: '12px' }}
                />
              ))}
              <span className="text-[10px] text-muted-foreground ml-1">More</span>
            </div>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}

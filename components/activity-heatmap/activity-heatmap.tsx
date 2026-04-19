'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import type { ActivityHeatmapProps } from './types';
import type { ActivityHeatmapResponse, HeatmapFilters } from '@/lib/heatmap/types';
import {
  DEFAULT_HEATMAP_FILTERS,
  HEATMAP_INTENSITY_CLASSES,
  generateGridDates,
  getIntensityLevel,
  formatDateKey,
  computePeriodDates,
} from '@/lib/heatmap/types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const VISIBLE_DAY_LABELS: readonly number[] = [1, 3, 5]; // Mon, Wed, Fri

async function fetchHeatmapData(filters: HeatmapFilters): Promise<ActivityHeatmapResponse> {
  const params = new URLSearchParams({ year: filters.year, agent: filters.agent });
  const response = await fetch(`/api/projects/activity-heatmap?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch heatmap data');
  return response.json();
}

function getInitialFilters(searchParams: URLSearchParams): HeatmapFilters {
  return {
    year: searchParams.get('year') || DEFAULT_HEATMAP_FILTERS.year,
    agent: searchParams.get('agent') || DEFAULT_HEATMAP_FILTERS.agent,
  };
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y!, m! - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<HeatmapFilters>(() => getInitialFilters(searchParams));

  const shouldUseInitialData =
    filters.year === initialData.filters.year && filters.agent === initialData.filters.agent;

  const { data: heatmap } = useQuery({
    queryKey: queryKeys.projects.heatmap(filters.year, filters.agent),
    queryFn: () => fetchHeatmapData(filters),
    initialData: shouldUseInitialData ? initialData : undefined,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const updateFilters = (next: HeatmapFilters) => {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());

    if (next.year === DEFAULT_HEATMAP_FILTERS.year) {
      params.delete('year');
    } else {
      params.set('year', next.year);
    }

    if (next.agent === DEFAULT_HEATMAP_FILTERS.agent) {
      params.delete('agent');
    } else {
      params.set('agent', next.agent);
    }

    const paramStr = params.toString();
    router.push(paramStr ? `?${paramStr}` : '?', { scroll: false });
  };

  const gridData = useMemo(() => {
    if (!heatmap) return null;
    const { startDate, endDate } = computePeriodDates(heatmap.filters.year);
    const gridDates = generateGridDates(startDate, endDate);

    const weeks: { date: Date; inRange: boolean; dateKey: string }[][] = [];
    for (let i = 0; i < gridDates.length; i += 7) {
      weeks.push(
        gridDates.slice(i, i + 7).map((gd) => ({
          ...gd,
          dateKey: formatDateKey(gd.date),
        }))
      );
    }

    const monthLabels: { label: string; colStart: number; colSpan: number }[] = [];
    let currentMonth = -1;
    for (let w = 0; w < weeks.length; w++) {
      const firstInRange = weeks[w]!.find((d) => d.inRange);
      if (!firstInRange) continue;
      const month = firstInRange.date.getMonth();
      if (month !== currentMonth) {
        if (monthLabels.length > 0) {
          const prev = monthLabels[monthLabels.length - 1]!;
          prev.colSpan = w - prev.colStart;
        }
        currentMonth = month;
        monthLabels.push({
          label: firstInRange.date.toLocaleDateString('en-US', { month: 'short' }),
          colStart: w,
          colSpan: 1,
        });
      }
    }
    if (monthLabels.length > 0) {
      const last = monthLabels[monthLabels.length - 1]!;
      last.colSpan = weeks.length - last.colStart;
    }

    return { weeks, monthLabels };
  }, [heatmap]);

  if (!heatmap || !gridData) return null;

  const { summary, thresholds, days, availableYears, availableAgents } = heatmap;
  const showYearSelector = availableYears.length > 1;
  const showAgentFilter = availableAgents.length > 1;
  const isEmpty = summary.totalJobs === 0;

  return (
    <Card className="border-ctp-mauve/15 aurora-bg-subtle" data-testid="activity-heatmap">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" data-testid="heatmap-summary">
          <span className="font-semibold text-foreground">{summary.totalJobs}</span> jobs
          {' + '}
          <span className="font-semibold text-foreground">{summary.ticketsShipped}</span> tickets shipped
        </p>
        <div className="flex gap-2">
          {showYearSelector && (
            <Select
              value={filters.year}
              onValueChange={(value) => updateFilters({ ...filters, year: value })}
            >
              <SelectTrigger className="w-[160px]" data-testid="heatmap-year-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y === 'rolling' ? 'Last 12 months' : y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {showAgentFilter && (
            <Select
              value={filters.agent}
              onValueChange={(value) => updateFilters({ ...filters, agent: value })}
            >
              <SelectTrigger className="w-[140px]" data-testid="heatmap-agent-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex min-h-[120px] items-center justify-center" data-testid="heatmap-empty">
            <p className="text-sm text-muted-foreground">
              No activity to show yet — your AI work will appear here
            </p>
          </div>
        ) : (
          <TooltipProvider>
            <div className="overflow-x-auto" data-testid="heatmap-grid-container">
              <div className="inline-flex gap-[3px]">
                <div className="flex flex-col gap-[3px] pt-5">
                  {DAY_LABELS.map((label, idx) => (
                    <div
                      key={label}
                      className="sticky left-0 z-10 flex h-[13px] w-8 items-center text-[10px] text-muted-foreground aurora-bg-subtle sm:h-[13px] max-sm:h-[16px]"
                    >
                      {VISIBLE_DAY_LABELS.includes(idx) ? label : ''}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex gap-[3px] mb-1">
                    {gridData.monthLabels.map((ml) => (
                      <div
                        key={`${ml.label}-${ml.colStart}`}
                        className="text-[10px] text-muted-foreground"
                        style={{ width: `${ml.colSpan * 16}px` }}
                      >
                        {ml.colSpan >= 2 ? ml.label : ''}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-[3px]">
                    {gridData.weeks.map((week, weekIdx) => (
                      <div key={weekIdx} className="flex flex-col gap-[3px]">
                        {week.map((cell) => {
                          if (!cell.inRange) {
                            return (
                              <div
                                key={cell.dateKey}
                                className="h-[13px] w-[13px] max-sm:h-[16px] max-sm:w-[16px]"
                              />
                            );
                          }

                          const dayData = days[cell.dateKey];
                          const count = dayData?.jobCount ?? 0;
                          const level = getIntensityLevel(count, thresholds);
                          const intensityClass = HEATMAP_INTENSITY_CLASSES[level];

                          const tooltipLines: string[] = [formatDisplayDate(cell.dateKey)];
                          if (dayData && count > 0) {
                            tooltipLines.push(`${count} job${count !== 1 ? 's' : ''}`);
                            if (dayData.shippedCount > 0) {
                              tooltipLines.push(
                                `${dayData.shippedCount} ticket${dayData.shippedCount !== 1 ? 's' : ''} shipped`
                              );
                            }
                            if (dayData.costUsd !== null) {
                              tooltipLines.push(`$${dayData.costUsd.toFixed(2)}`);
                            }
                          } else {
                            tooltipLines.push('No activity');
                          }

                          return (
                            <Tooltip key={cell.dateKey}>
                              <TooltipTrigger asChild>
                                <div
                                  data-testid="heatmap-cell"
                                  data-date={cell.dateKey}
                                  data-level={level}
                                  className={`h-[13px] w-[13px] max-sm:h-[16px] max-sm:w-[16px] cursor-pointer rounded-sm ${intensityClass}`}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  {tooltipLines.map((line, i) => (
                                    <p key={i} className={i === 0 ? 'font-medium' : ''}>
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TooltipProvider>
        )}
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground" data-testid="heatmap-legend">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <div
              key={level}
              className={`h-[10px] w-[10px] rounded-sm ${HEATMAP_INTENSITY_CLASSES[level]}`}
            />
          ))}
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  );
}

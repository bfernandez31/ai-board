'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import { HEATMAP_PERIOD_ROLLING } from '@/lib/heatmap/types';
import type {
  HeatmapAgentFilter,
  HeatmapData,
  HeatmapFilters,
  HeatmapPeriod,
} from '@/lib/heatmap/types';
import {
  DEFAULT_HEATMAP_FILTERS,
  intensityClass,
  isValidHeatmapAgent,
  isValidHeatmapPeriod,
} from '@/lib/heatmap/aggregations';
import { HeatmapGrid } from './heatmap-grid';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ProjectsActivityHeatmapProps {
  initialData: HeatmapData;
}

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams({ period: filters.period, agent: filters.agent });
  const response = await fetch(`/api/heatmap?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to fetch heatmap');
  return response.json();
}

function filtersMatch(left: HeatmapFilters, right: HeatmapFilters): boolean {
  return left.period === right.period && left.agent === right.agent;
}

function getInitialFilters(
  searchParams: URLSearchParams,
  initialData: HeatmapData
): HeatmapFilters {
  const rawPeriod = searchParams.get('heatmapPeriod');
  const rawAgent = searchParams.get('heatmapAgent');
  return {
    period:
      rawPeriod && isValidHeatmapPeriod(rawPeriod)
        ? (rawPeriod as HeatmapPeriod)
        : initialData.filters.period,
    agent:
      rawAgent && isValidHeatmapAgent(rawAgent)
        ? (rawAgent as HeatmapAgentFilter)
        : initialData.filters.agent,
  };
}

function buildSearchParams(searchParams: URLSearchParams, filters: HeatmapFilters): string {
  const params = new URLSearchParams(searchParams.toString());
  if (filters.period === DEFAULT_HEATMAP_FILTERS.period) {
    params.delete('heatmapPeriod');
  } else {
    params.set('heatmapPeriod', filters.period);
  }
  if (filters.agent === DEFAULT_HEATMAP_FILTERS.agent) {
    params.delete('heatmapAgent');
  } else {
    params.set('heatmapAgent', filters.agent);
  }
  return params.toString();
}

function buildHeaderText(totalJobs: number, totalShipped: number, period: HeatmapPeriod): string {
  const jobLabel = `${totalJobs} ${totalJobs === 1 ? 'job' : 'jobs'}`;
  const shippedLabel = `${totalShipped} ${totalShipped === 1 ? 'ticket' : 'tickets'} shipped`;
  const periodSuffix = period === HEATMAP_PERIOD_ROLLING ? 'in the last year' : `in ${period}`;
  return `${jobLabel} · ${shippedLabel} ${periodSuffix}`;
}

export function ProjectsActivityHeatmap({ initialData }: ProjectsActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(searchParams, initialData)
  );

  const shouldUseInitial = filtersMatch(filters, initialData.filters);

  const { data } = useQuery({
    queryKey: queryKeys.heatmap.data(filters.period, filters.agent),
    queryFn: () => fetchHeatmap(filters),
    initialData: shouldUseInitial ? initialData : undefined,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const heatmap = data ?? (shouldUseInitial ? initialData : undefined);

  const updateFilters = (next: HeatmapFilters) => {
    setFilters(next);
    const query = buildSearchParams(searchParams, next);
    router.replace(query ? `?${query}` : '?', { scroll: false });
  };

  const periodOptions = heatmap?.periodOptions ?? initialData.periodOptions;
  const agentOptions = heatmap?.agentOptions ?? initialData.agentOptions;
  const showAgentFilter = agentOptions.length > 2;
  const showPeriodFilter = periodOptions.length > 1;

  const headerText = useMemo(() => {
    if (!heatmap) return '';
    return buildHeaderText(heatmap.totalJobs, heatmap.totalShipped, heatmap.filters.period);
  }, [heatmap]);

  if (!heatmap) {
    return null;
  }

  return (
    <section
      className="mt-8 rounded-lg border border-border/50 bg-card/50 p-4 sm:p-6"
      aria-labelledby="heatmap-heading"
      data-testid="projects-activity-heatmap"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div>
          <h2 id="heatmap-heading" className="text-lg font-semibold text-foreground">
            Activity
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="heatmap-summary">
            {headerText}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {showAgentFilter && (
            <Select
              value={filters.agent}
              onValueChange={(value) =>
                updateFilters({ ...filters, agent: value as HeatmapAgentFilter })
              }
            >
              <SelectTrigger
                className="w-full sm:w-[160px]"
                data-testid="heatmap-agent-filter"
              >
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                {agentOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {showPeriodFilter && (
            <Select
              value={filters.period}
              onValueChange={(value) =>
                updateFilters({ ...filters, period: value as HeatmapPeriod })
              }
            >
              <SelectTrigger
                className="w-full sm:w-[180px]"
                data-testid="heatmap-period-filter"
              >
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {heatmap.totalJobs === 0 ? (
        <div
          className="flex items-center justify-center py-12 text-sm text-muted-foreground"
          data-testid="heatmap-empty"
        >
          No activity to show yet — your AI work will appear here
        </div>
      ) : (
        <HeatmapGrid days={heatmap.days} />
      )}

      <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            aria-hidden="true"
            className={`h-[12px] w-[12px] rounded-[2px] ${intensityClass(level as 0 | 1 | 2 | 3 | 4)}`}
          />
        ))}
        <span>More</span>
      </div>
    </section>
  );
}

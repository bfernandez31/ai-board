'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import type {
  HeatmapAgentFilter,
  HeatmapData,
  HeatmapFilters,
  HeatmapPeriod,
} from '@/lib/activity-heatmap/types';
import { HEATMAP_AGENT_FILTER_VALUES } from '@/lib/activity-heatmap/types';
import { HeatmapGrid } from './heatmap-grid';
import { HeatmapFilters as HeatmapFiltersBar } from './heatmap-filters';

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

function periodToParam(period: HeatmapPeriod): string {
  return period === 'last-12-months' ? 'last-12-months' : String(period);
}

function paramToPeriod(value: string | null, available: number[]): HeatmapPeriod {
  if (!value || value === 'last-12-months') return 'last-12-months';
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || !available.includes(parsed)) {
    return 'last-12-months';
  }
  return parsed;
}

function paramToAgent(value: string | null): HeatmapAgentFilter {
  if (!value) return 'all';
  return (HEATMAP_AGENT_FILTER_VALUES as readonly string[]).includes(value)
    ? (value as HeatmapAgentFilter)
    : 'all';
}

function getInitialFilters(
  searchParams: URLSearchParams,
  initialData: HeatmapData
): HeatmapFilters {
  return {
    period: paramToPeriod(searchParams.get('heatmapPeriod'), initialData.availableYears),
    agent: paramToAgent(searchParams.get('heatmapAgent')),
  };
}

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams({
    period: periodToParam(filters.period),
    agent: filters.agent,
  });
  const res = await fetch(`/api/activity-heatmap?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch activity heatmap');
  }
  return res.json();
}

function filtersMatch(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.period === b.period && a.agent === b.agent;
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(searchParams, initialData)
  );

  const useInitial = filtersMatch(filters, initialData.filters);
  const { data } = useQuery({
    queryKey: queryKeys.activityHeatmap.data(periodToParam(filters.period), filters.agent),
    queryFn: () => fetchHeatmap(filters),
    initialData: useInitial ? initialData : undefined,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const heatmap = data ?? initialData;

  const updateFilters = (next: HeatmapFilters) => {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next.period === 'last-12-months') {
      params.delete('heatmapPeriod');
    } else {
      params.set('heatmapPeriod', periodToParam(next.period));
    }
    if (next.agent === 'all') {
      params.delete('heatmapAgent');
    } else {
      params.set('heatmapAgent', next.agent);
    }
    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : '?', { scroll: false });
  };

  const headerLabel = useMemo(() => {
    const period = heatmap.filters.period;
    const periodLabel =
      period === 'last-12-months' ? 'in the last year' : `in ${period}`;
    return `${heatmap.totalJobs.toLocaleString('en-US')} job${heatmap.totalJobs === 1 ? '' : 's'} · ${heatmap.totalTicketsShipped.toLocaleString('en-US')} ticket${heatmap.totalTicketsShipped === 1 ? '' : 's'} shipped ${periodLabel}`;
  }, [heatmap.totalJobs, heatmap.totalTicketsShipped, heatmap.filters.period]);

  return (
    <section
      className="mt-10 w-full"
      aria-labelledby="activity-heatmap-heading"
      data-testid="activity-heatmap"
    >
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="activity-heatmap-heading"
            className="text-xl font-semibold text-foreground"
          >
            Activity
          </h2>
          <p className="text-sm text-muted-foreground" data-testid="activity-heatmap-counter">
            {headerLabel}
          </p>
        </div>
        <HeatmapFiltersBar
          filters={filters}
          availableYears={heatmap.availableYears}
          availableAgents={heatmap.availableAgents}
          onChange={updateFilters}
        />
      </div>

      <HeatmapGrid data={heatmap} />
    </section>
  );
}

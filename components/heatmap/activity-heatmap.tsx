'use client';

import { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHeatmap } from '@/app/lib/hooks/queries/use-heatmap';
import type { HeatmapData, HeatmapFilters } from '@/lib/heatmap/types';
import { HeatmapHeader } from './heatmap-header';
import { HeatmapGrid } from './heatmap-grid';
import { HeatmapLegend } from './heatmap-legend';

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

function getInitialFilters(searchParams: URLSearchParams): HeatmapFilters {
  return {
    year: searchParams.get('year') || 'rolling',
    agent: (searchParams.get('agent') as HeatmapFilters['agent']) || 'all',
  };
}

function buildFilterSearchParams(
  searchParams: URLSearchParams,
  filters: HeatmapFilters
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  params.delete('year');
  params.delete('agent');
  if (filters.year !== 'rolling') params.set('year', filters.year);
  if (filters.agent !== 'all') params.set('agent', filters.agent);
  return params;
}

function filtersMatch(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.year === b.year && a.agent === b.agent;
}

function getPeriodDates(year: string): { startDate: string; endDate: string } {
  if (year === 'rolling') {
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 364));
    return {
      startDate: start.toISOString().split('T')[0]!,
      endDate: end.toISOString().split('T')[0]!,
    };
  }
  const y = parseInt(year, 10);
  return {
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
  };
}

function ActivityHeatmapInner({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(searchParams)
  );

  const shouldUseInitialData = filtersMatch(filters, initialData.filters);
  const { data } = useHeatmap(filters, shouldUseInitialData ? initialData : undefined);

  const heatmap = data ?? (shouldUseInitialData ? initialData : undefined);

  const updateFilters = (nextFilters: HeatmapFilters) => {
    setFilters(nextFilters);
    const params = buildFilterSearchParams(searchParams, nextFilters);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  };

  const { startDate, endDate } = useMemo(() => getPeriodDates(filters.year), [filters.year]);
  const periodLabel = filters.year === 'rolling' ? 'in the last year' : `in ${filters.year}`;

  if (!heatmap) return null;

  const isEmpty = heatmap.cells.length === 0;

  return (
    <div className="space-y-3" data-testid="activity-heatmap">
      <HeatmapHeader
        totalJobs={heatmap.summary.totalJobs}
        totalShipped={heatmap.summary.totalShipped}
        periodLabel={periodLabel}
        year={filters.year}
        agent={filters.agent}
        availableYears={heatmap.availableYears}
        availableAgents={heatmap.availableAgents}
        accountCreatedYear={heatmap.accountCreatedYear}
        onYearChange={(year) => updateFilters({ ...filters, year })}
        onAgentChange={(agent) => updateFilters({ ...filters, agent: agent as HeatmapFilters['agent'] })}
      />

      {isEmpty ? (
        <div className="flex items-center justify-center py-12" data-testid="heatmap-empty-state">
          <p className="text-sm text-muted-foreground">
            No activity to show yet — your AI work will appear here
          </p>
        </div>
      ) : (
        <HeatmapGrid
          cells={heatmap.cells}
          thresholds={heatmap.thresholds}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      <HeatmapLegend />
    </div>
  );
}

export function ActivityHeatmap(props: ActivityHeatmapProps) {
  return (
    <Suspense>
      <ActivityHeatmapInner {...props} />
    </Suspense>
  );
}

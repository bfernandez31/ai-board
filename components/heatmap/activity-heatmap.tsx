'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import type { AgentFilter } from '@/lib/analytics/types';
import type { HeatmapData, HeatmapFilters } from '@/lib/heatmap/types';
import { buildHeatmapGrid, computeIntensityLevels, getPeriodBounds } from '@/lib/heatmap/utils';
import { HeatmapGrid } from './heatmap-grid';
import { HeatmapLegend } from './heatmap-legend';
import { HeatmapFilters as HeatmapFilterControls } from './heatmap-filters';

interface ActivityHeatmapProps {
  initialData: HeatmapData;
}

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams({
    year: filters.year,
    agent: filters.agent,
  });
  const response = await fetch(`/api/heatmap?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch heatmap data');
  }
  return response.json();
}

function getInitialFilters(searchParams: URLSearchParams): HeatmapFilters {
  return {
    year: searchParams.get('year') || 'last-12-months',
    agent: (searchParams.get('agent') as AgentFilter) || 'all',
  };
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(searchParams)
  );

  const isDefaultFilters = filters.year === 'last-12-months' && filters.agent === 'all';

  const { data } = useQuery({
    queryKey: queryKeys.heatmap.data(filters.year, filters.agent),
    queryFn: () => fetchHeatmap(filters),
    initialData: isDefaultFilters ? initialData : undefined,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const heatmap = data ?? initialData;

  const updateFilters = (nextFilters: HeatmapFilters) => {
    setFilters(nextFilters);
    const params = new URLSearchParams(searchParams.toString());
    if (nextFilters.year !== 'last-12-months') {
      params.set('year', nextFilters.year);
    } else {
      params.delete('year');
    }
    if (nextFilters.agent !== 'all') {
      params.set('agent', nextFilters.agent);
    } else {
      params.delete('agent');
    }
    const search = params.toString();
    router.replace(search ? `?${search}` : '?', { scroll: false });
  };

  const now = useMemo(() => new Date(), []);
  const { start: periodStart, end: periodEnd } = useMemo(
    () => getPeriodBounds(filters.year, now),
    [filters.year, now]
  );

  const processedGrid = useMemo(() => {
    const grid = buildHeatmapGrid(heatmap.days, periodStart, periodEnd);
    // Apply intensity levels to all non-null cells
    const allCells = grid.flat().filter((c): c is NonNullable<typeof c> => c !== null);
    const withLevels = computeIntensityLevels(allCells);

    // Build lookup by date string
    const levelMap = new Map<string, typeof withLevels[number]>();
    for (const cell of withLevels) {
      levelMap.set(cell.date.toISOString().slice(0, 10), cell);
    }

    // Apply levels back to grid
    return grid.map((row) =>
      row.map((cell) => {
        if (!cell) return null;
        const key = cell.date.toISOString().slice(0, 10);
        return levelMap.get(key) ?? cell;
      })
    );
  }, [heatmap.days, periodStart, periodEnd]);

  const userCreatedYear = new Date(heatmap.userCreatedAt).getFullYear();
  const periodLabel = filters.year === 'last-12-months' ? 'in the last year' : `in ${filters.year}`;
  const isEmpty = heatmap.totalJobs === 0;

  return (
    <div className="mt-8 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{heatmap.totalJobs} jobs</span>
          {' · '}
          <span className="font-medium text-foreground">{heatmap.totalShipped} tickets shipped</span>
          {' '}
          {periodLabel}
        </div>

        <div className="flex items-center gap-3">
          <HeatmapFilterControls
            year={filters.year}
            agent={filters.agent}
            availableYears={heatmap.availableYears}
            availableAgents={heatmap.availableAgents}
            userCreatedYear={userCreatedYear}
            onYearChange={(year) => updateFilters({ ...filters, year })}
            onAgentChange={(agent) => updateFilters({ ...filters, agent })}
          />
          <HeatmapLegend />
        </div>
      </div>

      {isEmpty ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No activity to show yet — your AI work will appear here
        </div>
      ) : (
        <HeatmapGrid
          grid={processedGrid}
          periodStart={periodStart}
          periodEnd={periodEnd}
        />
      )}
    </div>
  );
}

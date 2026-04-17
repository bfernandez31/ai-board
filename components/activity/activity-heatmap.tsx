'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActivityHeatmap } from '@/hooks/use-activity-heatmap';
import type {
  HeatmapAgentFilter,
  HeatmapFilters,
  HeatmapResponse,
  HeatmapYearSelection,
} from '@/lib/activity/heatmap-types';
import { AGENT_FILTER_VALUES } from '@/lib/analytics/types';
import { ActivityHeatmapGrid } from './activity-heatmap-grid';
import { ActivityHeatmapCounter } from './activity-heatmap-counter';
import { ActivityHeatmapLegend } from './activity-heatmap-legend';
import { ActivityHeatmapFilters } from './activity-heatmap-filters';

interface ActivityHeatmapProps {
  initialData: HeatmapResponse;
}

function filtersMatch(a: HeatmapFilters, b: HeatmapFilters): boolean {
  return a.year === b.year && a.agent === b.agent && a.timezone === b.timezone;
}

function resolveClientTimezone(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || fallback;
  } catch {
    return fallback;
  }
}

function readFilters(
  searchParams: URLSearchParams,
  initialData: HeatmapResponse,
  timezone: string
): HeatmapFilters {
  const rawYear = searchParams.get('year') as HeatmapYearSelection | null;
  const validYearValues = new Set(initialData.yearOptions.map((o) => o.value));
  const year = rawYear && validYearValues.has(rawYear) ? rawYear : initialData.filters.year;

  const rawAgent = searchParams.get('agent') as HeatmapAgentFilter | null;
  const agent =
    rawAgent && (AGENT_FILTER_VALUES as readonly string[]).includes(rawAgent)
      ? rawAgent
      : initialData.filters.agent;

  return { year, agent, timezone };
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clientTimezone] = useState(() =>
    resolveClientTimezone(initialData.filters.timezone)
  );
  const filters = useMemo<HeatmapFilters>(
    () =>
      readFilters(
        new URLSearchParams(searchParams?.toString() ?? ''),
        initialData,
        clientTimezone
      ),
    [searchParams, initialData, clientTimezone]
  );

  const shouldUseInitialData = filtersMatch(filters, initialData.filters);
  const { data } = useActivityHeatmap(filters, {
    initialData,
    shouldUseInitialData,
  });

  const heatmap = data ?? initialData;

  const updateFilters = (next: Partial<HeatmapFilters>) => {
    const merged: HeatmapFilters = { ...filters, ...next };
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('year', merged.year);
    params.set('agent', merged.agent);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const hasActivity = heatmap.counters.totalJobs > 0;

  return (
    <section
      className="mt-8 space-y-4"
      aria-label="Activity heatmap"
      data-testid="activity-heatmap"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ActivityHeatmapCounter counters={heatmap.counters} />
        <ActivityHeatmapFilters
          filters={filters}
          yearOptions={heatmap.yearOptions}
          agentOptions={heatmap.agentOptions}
          onChange={updateFilters}
        />
      </div>

      {hasActivity ? (
        <ActivityHeatmapGrid days={heatmap.days} range={heatmap.range} />
      ) : (
        <div
          className="flex items-center justify-center rounded-md border border-border/50 bg-muted/20 py-12 text-sm text-muted-foreground"
          data-testid="activity-heatmap-empty"
        >
          No activity to show yet — your AI work will appear here
        </div>
      )}

      <div className="flex justify-end">
        <ActivityHeatmapLegend />
      </div>
    </section>
  );
}

'use client';

import { useMemo, type ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { queryKeys } from '@/app/lib/query-keys';
import { isSupportedAgent } from '@/app/lib/utils/agent-resolution';
import type {
  AgentFilter,
  HeatmapData,
  HeatmapFilters,
  HeatmapPeriod,
} from '@/lib/analytics/heatmap-types';
import { ActivityHeatmapGrid } from './activity-heatmap-grid';
import { BUCKET_CLASSES } from './activity-heatmap-cell';

interface ActivityHeatmapProps {
  userId: string;
  initialData: HeatmapData | null;
  initialError?: { message: string };
}

function coercePeriod(rawPeriod: string | null): HeatmapPeriod {
  if (rawPeriod && /^\d{4}$/.test(rawPeriod)) {
    const year = Number.parseInt(rawPeriod, 10);
    return { kind: 'year', year };
  }
  return { kind: 'rolling12m', endDate: '' };
}

function coerceAgent(rawAgent: string | null): AgentFilter {
  if (!rawAgent || rawAgent === 'all') return 'all';
  return isSupportedAgent(rawAgent) ? rawAgent : 'all';
}

function periodKey(period: HeatmapPeriod): string {
  return period.kind === 'year' ? String(period.year) : 'last12months';
}

function filtersMatch(a: HeatmapFilters, b: HeatmapFilters): boolean {
  if (a.agent !== b.agent) return false;
  if (a.period.kind !== b.period.kind) return false;
  if (a.period.kind === 'year' && b.period.kind === 'year') {
    return a.period.year === b.period.year;
  }
  return true;
}

async function fetchHeatmap(filters: HeatmapFilters): Promise<HeatmapData> {
  const params = new URLSearchParams();
  if (filters.period.kind === 'year') {
    params.set('period', String(filters.period.year));
  }
  if (filters.agent !== 'all') {
    params.set('agent', filters.agent);
  }
  const qs = params.toString();
  const response = await fetch(`/api/activity/heatmap${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error('Failed to fetch heatmap');
  }
  return response.json();
}

function LegendSwatch({ bucket }: { bucket: 0 | 1 | 2 | 3 | 4 }): ReactElement {
  return (
    <span
      className={`${BUCKET_CLASSES[bucket]} inline-block rounded-sm`}
      style={{ width: 12, height: 12 }}
      aria-hidden="true"
    />
  );
}

function HeatmapLegend(): ReactElement {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>Less</span>
      <LegendSwatch bucket={0} />
      <LegendSwatch bucket={1} />
      <LegendSwatch bucket={2} />
      <LegendSwatch bucket={3} />
      <LegendSwatch bucket={4} />
      <span>More</span>
    </div>
  );
}

export function ActivityHeatmap({
  userId,
  initialData,
  initialError,
}: ActivityHeatmapProps): ReactElement {
  const searchParams = useSearchParams();

  const filters = useMemo<HeatmapFilters>(() => {
    const period = coercePeriod(searchParams.get('heatmapPeriod'));
    const agent = coerceAgent(searchParams.get('heatmapAgent'));
    return { period, agent };
  }, [searchParams]);

  const shouldUseInitialData = useMemo(
    () => (initialData ? filtersMatch(filters, initialData.filters) : false),
    [filters, initialData]
  );

  const { data, error } = useQuery({
    queryKey: queryKeys.heatmap.data(userId, periodKey(filters.period), filters.agent),
    queryFn: () => fetchHeatmap(filters),
    initialData: shouldUseInitialData && initialData ? initialData : undefined,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const heatmap = data ?? (shouldUseInitialData ? initialData : null);
  const hasError = !heatmap && (initialError !== undefined || error);

  if (hasError) {
    return (
      <section className="mt-8 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Activity</h2>
        <p className="text-sm text-muted-foreground">
          {initialError?.message ?? "Couldn't load activity — please refresh"}
        </p>
      </section>
    );
  }

  if (!heatmap) {
    return (
      <section className="mt-8 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Activity</h2>
        <HeatmapLegend />
      </section>
    );
  }

  const hasAnyActivity = heatmap.cells.some((c) => c.jobCount > 0);

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-6 space-y-4">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          {heatmap.summary.totalJobs} jobs · {heatmap.summary.distinctShippedTickets} tickets shipped {heatmap.summary.periodLabel}
        </h2>
      </header>
      {hasAnyActivity ? (
        <ActivityHeatmapGrid
          cells={heatmap.cells}
          startDate={heatmap.period.startDate}
          endDate={heatmap.period.endDate}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No activity to show yet — your AI work will appear here
          </p>
        </div>
      )}
      <HeatmapLegend />
    </section>
  );
}

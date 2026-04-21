'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AGENT_FILTER_VALUES, type AgentFilter } from '@/lib/analytics/types';
import {
  enumerateYearsSinceJoin,
  parsePeriodParam,
  serializePeriodParam,
} from '@/lib/heatmap/period';
import { useActivityHeatmap } from '@/hooks/use-activity-heatmap';
import type { HeatmapData, HeatmapFilters, HeatmapPeriodKey } from '@/lib/heatmap/types';
import { ActivityHeatmapHeader } from './activity-heatmap-header';
import { ActivityHeatmapGrid } from './activity-heatmap-grid';
import { ActivityHeatmapLegend } from './activity-heatmap-legend';
import { ActivityHeatmapEmpty } from './activity-heatmap-empty';

interface ActivityHeatmapSectionProps {
  initialData: HeatmapData;
  accountCreatedYear: number;
}

function isAgentFilter(value: string | null): value is AgentFilter {
  if (value === null) return false;
  return (AGENT_FILTER_VALUES as readonly string[]).includes(value);
}

function getInitialFilters(
  searchParams: URLSearchParams,
  initialData: HeatmapData,
  accountCreatedYear: number
): HeatmapFilters {
  const rawPeriod = searchParams.get('period');
  const rawAgent = searchParams.get('agent');

  const period: HeatmapPeriodKey = rawPeriod
    ? parsePeriodParam(rawPeriod, accountCreatedYear)
    : initialData.filters.period;

  const agent: AgentFilter = isAgentFilter(rawAgent) ? rawAgent : initialData.filters.agent;

  return { period, agent };
}

function buildFilterSearchParams(
  searchParams: URLSearchParams,
  filters: HeatmapFilters
): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString());
  const periodParam = serializePeriodParam(filters.period);
  if (periodParam === '12m') {
    params.delete('period');
  } else {
    params.set('period', periodParam);
  }
  if (filters.agent === 'all') {
    params.delete('agent');
  } else {
    params.set('agent', filters.agent);
  }
  return params;
}

export function ActivityHeatmapSection({
  initialData,
  accountCreatedYear,
}: ActivityHeatmapSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<HeatmapFilters>(() =>
    getInitialFilters(
      new URLSearchParams(searchParams?.toString() ?? ''),
      initialData,
      accountCreatedYear
    )
  );

  const { data } = useActivityHeatmap(filters, initialData);
  const heatmap = data ?? initialData;

  const availableYears = useMemo(
    () => enumerateYearsSinceJoin(accountCreatedYear),
    [accountCreatedYear]
  );

  const updateFilters = useCallback(
    (next: HeatmapFilters) => {
      setFilters(next);
      const params = buildFilterSearchParams(
        new URLSearchParams(searchParams?.toString() ?? ''),
        next
      );
      const qs = params.toString();
      router.push(qs ? `?${qs}` : '?', { scroll: false });
    },
    [router, searchParams]
  );

  const handlePeriodChange = useCallback(
    (period: HeatmapPeriodKey) => {
      updateFilters({ ...filters, period });
    },
    [filters, updateFilters]
  );

  const handleAgentChange = useCallback(
    (agent: AgentFilter) => {
      updateFilters({ ...filters, agent });
    },
    [filters, updateFilters]
  );

  const showEmpty =
    filters.agent === 'all' &&
    heatmap.totals.jobs === 0 &&
    heatmap.totals.ticketsShipped === 0;

  return (
    <section
      className="mt-10 space-y-4"
      aria-label="Activity heatmap"
      data-testid="activity-heatmap-section"
    >
      <ActivityHeatmapHeader
        totals={heatmap.totals}
        period={heatmap.period}
        selectedPeriod={filters.period}
        availableYears={availableYears}
        onPeriodChange={handlePeriodChange}
        availableAgents={heatmap.availableAgents}
        selectedAgent={filters.agent}
        onAgentChange={handleAgentChange}
      />

      {showEmpty ? (
        <ActivityHeatmapEmpty />
      ) : (
        <ActivityHeatmapGrid
          days={heatmap.days}
          startDate={heatmap.period.startDate}
          endDate={heatmap.period.endDate}
        />
      )}

      <ActivityHeatmapLegend />
    </section>
  );
}

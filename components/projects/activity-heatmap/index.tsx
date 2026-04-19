'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useActivityHeatmap } from '@/hooks/use-activity-heatmap';
import type {
  HeatmapAgentFilter,
  HeatmapFilters,
  HeatmapPayload,
  HeatmapPeriod,
} from '@/lib/analytics/heatmap-types';
import { HEATMAP_AGENT_FILTER_VALUES } from '@/lib/analytics/heatmap-types';
import { HeatmapGrid } from './heatmap-grid';
import { HeatmapLegend } from './heatmap-legend';
import { HeatmapFilters as HeatmapFiltersComponent } from './heatmap-filters';

interface ActivityHeatmapProps {
  initialData: HeatmapPayload;
}

function parsePeriod(raw: string | null, availableYears: number[]): HeatmapPeriod {
  if (!raw || raw === 'last-12-months') return { kind: 'last-12-months' };
  const year = Number.parseInt(raw, 10);
  if (!Number.isInteger(year) || !availableYears.includes(year)) {
    return { kind: 'last-12-months' };
  }
  return { kind: 'calendar-year', year };
}

function parseAgent(raw: string | null): HeatmapAgentFilter {
  if (raw && (HEATMAP_AGENT_FILTER_VALUES as readonly string[]).includes(raw)) {
    return raw as HeatmapAgentFilter;
  }
  return 'all';
}

function resolveBrowserTimezone(fallback: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}

export function ActivityHeatmap({ initialData }: ActivityHeatmapProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const availableYears = initialData.availableYears;

  const [browserTz, setBrowserTz] = useState<string>(initialData.filters.timezone);

  useEffect(() => {
    const resolved = resolveBrowserTimezone(initialData.filters.timezone);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the browser's IANA timezone is inherently a post-mount platform API lookup
    setBrowserTz(resolved);
  }, [initialData.filters.timezone]);

  const filters: HeatmapFilters = useMemo(() => {
    return {
      period: parsePeriod(searchParams.get('period'), availableYears),
      agent: parseAgent(searchParams.get('agent')),
      timezone: browserTz,
    };
  }, [searchParams, availableYears, browserTz]);

  const { data } = useActivityHeatmap({ filters, initialData });
  const payload = data ?? initialData;

  const todayKey = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: payload.filters.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }, [payload.filters.timezone]);

  const isEmpty = payload.totals.jobs === 0;
  const headerLabel = payload.meta.label;

  const updateFilter = (next: Partial<{ period: string; agent: HeatmapAgentFilter }>) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.period !== undefined) {
      if (next.period === 'last-12-months') {
        params.delete('period');
      } else {
        params.set('period', next.period);
      }
    }
    if (next.agent !== undefined) {
      if (next.agent === 'all') {
        params.delete('agent');
      } else {
        params.set('agent', next.agent);
      }
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : '?', { scroll: false });
  };

  return (
    <section
      className="mt-8 rounded-lg border border-border bg-card p-4 sm:p-6"
      aria-label="Activity heatmap"
      data-testid="activity-heatmap"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">AI activity</h2>
          <p className="text-sm text-muted-foreground" data-testid="activity-heatmap-header">
            {payload.totals.jobs} jobs · {payload.totals.shippedTickets} tickets shipped in {headerLabel}
          </p>
        </div>
        <HeatmapFiltersComponent
          filters={filters}
          distinctAgents={payload.distinctAgents}
          availableYears={availableYears}
          onChange={updateFilter}
        />
      </div>
      <div className="mt-4 space-y-3">
        <HeatmapGrid
          days={payload.days}
          meta={payload.meta}
          isEmpty={isEmpty}
          todayKey={todayKey}
        />
        <HeatmapLegend />
      </div>
    </section>
  );
}

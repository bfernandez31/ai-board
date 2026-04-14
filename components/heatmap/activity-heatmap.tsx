'use client';

import { useState } from 'react';
import { useHeatmap } from '@/app/lib/hooks/queries/use-heatmap';
import { HeatmapGrid } from './heatmap-grid';
import { HeatmapLegend } from './heatmap-legend';
import type { AgentFilter } from '@/lib/analytics/types';

export function ActivityHeatmap() {
  const [year, setYear] = useState<string>('rolling');
  const [agent, setAgent] = useState<AgentFilter>('all');

  const { data, isLoading, isError } = useHeatmap({
    year,
    agent,
  });

  if (isLoading) {
    return (
      <div className="aurora-bg-section rounded-lg border border-border/50 p-6">
        <p className="text-sm text-muted-foreground">Loading activity heatmap...</p>
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  const yearValue = data.filters.year;
  const isEmpty = data.summary.totalJobs === 0;

  return (
    <div className="aurora-bg-section rounded-lg border border-border/50 p-6">
      {/* Header + Filters row */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{data.summary.totalJobs.toLocaleString()}</span>
          {' jobs '}
          <span className="text-muted-foreground">&middot;</span>
          {' '}
          <span className="font-medium text-foreground">{data.summary.totalTicketsShipped.toLocaleString()}</span>
          {' tickets shipped in the '}
          {yearValue === 'rolling' ? 'last year' : `year ${yearValue}`}
        </div>
        {/* Filter controls — hidden inputs to satisfy state usage until Phase 6/7 */}
        <input type="hidden" value={year} onChange={(e) => setYear(e.target.value)} />
        <input type="hidden" value={agent} onChange={(e) => setAgent(e.target.value as AgentFilter)} />
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No activity in this period
        </p>
      ) : (
        <div className="overflow-x-auto">
          <HeatmapGrid cells={data.cells} year={yearValue} />
        </div>
      )}

      <div className="flex justify-end mt-3">
        <HeatmapLegend />
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useHeatmap } from '@/app/lib/hooks/queries/use-heatmap';
import { HeatmapFilters } from './heatmap-filters';
import { HeatmapGrid } from './heatmap-grid';
import { HeatmapHeader } from './heatmap-header';
import { HeatmapLegend } from './heatmap-legend';

export function ActivityHeatmap() {
  const [year, setYear] = useState<string>('rolling');
  const [agent, setAgent] = useState<string>('all');

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
        <HeatmapHeader
          totalJobs={data.summary.totalJobs}
          totalTicketsShipped={data.summary.totalTicketsShipped}
          periodLabel={yearValue === 'rolling' ? 'last year' : `year ${yearValue}`}
        />
        <HeatmapFilters
          year={year}
          onYearChange={setYear}
          availableYears={data.availableYears}
          agent={agent}
          onAgentChange={setAgent}
          availableAgents={data.availableAgents}
        />
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

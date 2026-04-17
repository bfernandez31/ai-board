import type { HeatmapCounters } from '@/lib/activity/heatmap-types';

interface ActivityHeatmapCounterProps {
  counters: HeatmapCounters;
}

export function ActivityHeatmapCounter({ counters }: ActivityHeatmapCounterProps) {
  return (
    <h2
      className="text-lg font-medium text-foreground"
      data-testid="activity-heatmap-counter"
    >
      {counters.totalJobs} jobs · {counters.ticketsShipped} tickets shipped{' '}
      {counters.periodLabel}
    </h2>
  );
}

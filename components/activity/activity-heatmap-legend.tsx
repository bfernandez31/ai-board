import { getIntensityClass } from '@/lib/activity/heatmap-bucketing';

export function ActivityHeatmapLegend() {
  const levels: Array<0 | 1 | 2 | 3 | 4> = [0, 1, 2, 3, 4];
  return (
    <div
      className="flex items-center gap-2 text-xs text-muted-foreground"
      data-testid="activity-heatmap-legend"
      aria-label="Activity intensity legend"
    >
      <span>Less</span>
      {levels.map((level) => (
        <span
          key={level}
          className={`h-3 w-3 rounded-sm ${getIntensityClass(level)}`}
          aria-hidden="true"
        />
      ))}
      <span>More</span>
    </div>
  );
}

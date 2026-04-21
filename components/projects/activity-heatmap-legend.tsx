'use client';

const SWATCH_CLASSES = [
  'bg-muted/40 border border-border/40',
  'bg-violet-200 dark:bg-violet-900/50',
  'bg-violet-400 dark:bg-violet-700',
  'bg-violet-500 dark:bg-violet-600',
  'bg-violet-600 dark:bg-violet-400',
] as const;

export function ActivityHeatmapLegend() {
  return (
    <div
      className="flex items-center gap-2 text-xs text-muted-foreground"
      data-testid="activity-heatmap-legend"
      aria-label="Activity heatmap intensity legend"
    >
      <span>Less</span>
      <div className="flex items-center gap-1">
        {SWATCH_CLASSES.map((swatchClass, index) => (
          <span
            key={index}
            className={`inline-block h-3 w-3 rounded-sm ${swatchClass}`}
            aria-hidden="true"
          />
        ))}
      </div>
      <span>More</span>
    </div>
  );
}

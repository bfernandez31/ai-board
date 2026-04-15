import { INTENSITY_CLASSES } from '@/lib/heatmap/utils';

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>Less</span>
      {INTENSITY_CLASSES.map((cls, i) => (
        <div
          key={i}
          data-testid="legend-cell"
          className={`w-[14px] h-[14px] rounded-sm ${cls}`}
        />
      ))}
      <span>More</span>
    </div>
  );
}

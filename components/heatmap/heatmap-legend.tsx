import { HEATMAP_INTENSITY_CLASSES } from './palette';

export function HeatmapLegend() {
  return (
    <div className="flex items-center justify-end gap-1" data-testid="heatmap-legend">
      <span className="text-xs text-muted-foreground mr-1">Less</span>
      {HEATMAP_INTENSITY_CLASSES.map((cls, i) => (
        <div
          key={i}
          className={`rounded-sm ${cls}`}
          style={{ width: '13px', height: '13px' }}
          data-testid="legend-swatch"
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">More</span>
    </div>
  );
}

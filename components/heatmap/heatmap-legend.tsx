const LEGEND_CLASSES = [
  'bg-muted',
  'bg-primary/20',
  'bg-primary/40',
  'bg-primary/60',
  'bg-primary/80',
] as const;

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>Less</span>
      {LEGEND_CLASSES.map((cls, i) => (
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

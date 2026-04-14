'use client';

const LEGEND_LEVELS = [
  'bg-muted/50',
  'bg-violet-900/40',
  'bg-violet-700/50',
  'bg-violet-500/60',
  'bg-violet-400/80',
];

export function HeatmapLegend() {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <span>Less</span>
      {LEGEND_LEVELS.map((cls, i) => (
        <div
          key={i}
          className={`w-[13px] h-[13px] rounded-[2px] ${cls}`}
        />
      ))}
      <span>More</span>
    </div>
  );
}

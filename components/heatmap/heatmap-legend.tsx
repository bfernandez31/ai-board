'use client';

import { INTENSITY_CLASSES } from './heatmap-cell';

const LEGEND_LEVELS = Object.values(INTENSITY_CLASSES);

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

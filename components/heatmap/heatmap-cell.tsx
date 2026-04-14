'use client';

import type { IntensityLevel } from '@/lib/heatmap/types';

const INTENSITY_CLASSES: Record<IntensityLevel, string> = {
  0: 'bg-muted/50',
  1: 'bg-violet-900/40',
  2: 'bg-violet-700/50',
  3: 'bg-violet-500/60',
  4: 'bg-violet-400/80',
};

interface HeatmapCellProps {
  date: string;
  intensity: IntensityLevel;
  jobCount: number;
  costUsd: number | null;
  ticketsShipped: number;
}

export function HeatmapCell({ date, intensity }: HeatmapCellProps) {
  return (
    <div
      className={`w-[13px] h-[13px] rounded-[2px] ${INTENSITY_CLASSES[intensity]}`}
      data-date={date}
      data-testid="heatmap-cell"
    />
  );
}

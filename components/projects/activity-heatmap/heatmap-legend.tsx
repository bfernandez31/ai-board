import { cn } from '@/lib/utils';
import { getLevelClass } from './heatmap-grid';

export function HeatmapLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}
      data-testid="activity-heatmap-legend"
    >
      <span>Less</span>
      {([0, 1, 2, 3, 4] as const).map((level) => (
        <span
          key={level}
          aria-hidden="true"
          className={cn('h-3 w-3 rounded-sm', getLevelClass(level))}
        />
      ))}
      <span>More</span>
    </div>
  );
}

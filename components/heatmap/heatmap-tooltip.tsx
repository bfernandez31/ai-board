import type { HeatmapCell } from '@/lib/heatmap/types';

interface HeatmapTooltipProps {
  cell: HeatmapCell;
  position: { x: number; y: number };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function HeatmapTooltip({ cell, position }: HeatmapTooltipProps) {
  const showAbove = position.y > 80;

  return (
    <div
      data-testid="heatmap-tooltip"
      className="absolute z-50 pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: showAbove ? `${position.y - 8}px` : `${position.y + 22}px`,
        transform: showAbove ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      }}
    >
      <div className="bg-popover text-popover-foreground border border-border rounded-md px-3 py-2 text-xs shadow-md whitespace-nowrap">
        <div className="font-medium">{formatDate(cell.date)}</div>
        <div className="text-muted-foreground mt-0.5">
          {cell.jobCount} {cell.jobCount === 1 ? 'job' : 'jobs'}
        </div>
        {cell.costUsd !== null && (
          <div className="text-muted-foreground">
            ${cell.costUsd.toFixed(2)}
          </div>
        )}
        {cell.shippedTickets.length > 0 && (
          <div className="text-muted-foreground mt-0.5">
            Shipped: {cell.shippedTickets.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

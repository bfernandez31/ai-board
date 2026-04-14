'use client';

interface HeatmapHeaderProps {
  totalJobs: number;
  totalTicketsShipped: number;
  periodLabel: string;
}

export function HeatmapHeader({ totalJobs, totalTicketsShipped, periodLabel }: HeatmapHeaderProps) {
  return (
    <div className="text-sm text-muted-foreground" data-testid="heatmap-header">
      <span className="font-medium text-foreground">{totalJobs.toLocaleString()}</span>
      {' jobs '}
      <span className="text-muted-foreground">&middot;</span>
      {' '}
      <span className="font-medium text-foreground">{totalTicketsShipped.toLocaleString()}</span>
      {' tickets shipped in the '}
      {periodLabel}
    </div>
  );
}

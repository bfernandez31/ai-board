'use client';

export function ActivityHeatmapEmpty() {
  return (
    <div
      className="flex items-center justify-center rounded-md border border-border/40 bg-card/40 px-6 py-10 text-sm text-muted-foreground"
      data-testid="activity-heatmap-empty"
    >
      No activity to show yet — your AI work will appear here
    </div>
  );
}

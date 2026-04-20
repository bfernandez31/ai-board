import { HeatmapStats, HeatmapFilters } from "@/lib/types/activity";

interface ActivityHeatmapHeaderProps {
  stats: HeatmapStats;
  filters: HeatmapFilters;
  onAgentChange?: (agent: string | null) => void;
  onYearChange?: (year: string) => void;
}

export function ActivityHeatmapHeader({ stats, filters }: ActivityHeatmapHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
      <div className="flex flex-col">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          AI Activity
        </h2>
        <div className="flex gap-4 mt-1">
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{stats.totalJobs}</span> Jobs
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{stats.totalShippedTickets}</span> Shipped
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {/* US2/US3 Dropdowns will go here in later tasks */}
        <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-border/50">
          {filters.currentYear === "last-12-months" ? "Last 12 Months" : filters.currentYear}
        </div>
      </div>
    </div>
  );
}

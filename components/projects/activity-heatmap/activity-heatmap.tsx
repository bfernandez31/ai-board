import { getHeatmapData } from "@/lib/db/activity";
import { getCurrentUserOrNull } from "@/lib/db/users";
import { getRollingAnnualRange, getCalendarYearRange } from "@/lib/utils/activity-date-utils";
import { Agent } from "@prisma/client";
import { ActivityHeatmapHeader } from "./activity-heatmap-header";
import { ActivityHeatmapGrid } from "./activity-heatmap-grid";
import { Card } from "@/components/ui/card";

interface ActivityHeatmapProps {
  searchParams: {
    agent?: string | undefined;
    year?: string | undefined;
  };
}

export async function ActivityHeatmap({ searchParams }: ActivityHeatmapProps) {
  const user = await getCurrentUserOrNull();
  if (!user) return null;

  const agent = searchParams.agent as Agent | undefined;
  const year = searchParams.year;

  let range;
  if (year && year !== "last-12-months") {
    range = getCalendarYearRange(parseInt(year, 10));
  } else {
    range = getRollingAnnualRange();
  }

  const data = await getHeatmapData({
    userId: user.id,
    start: range.start,
    end: range.end,
    agent: agent || null,
  });

  return (
    <Card className="mt-12 p-6 aurora-bg-section border-border/50">
      <ActivityHeatmapHeader stats={data.stats} filters={data.filters} />
      
      <div className="mt-4">
        {data.days.length === 0 && data.stats.totalJobs === 0 ? (
          <div className="h-[120px] flex items-center justify-center text-sm text-muted-foreground italic">
            No activity to show yet — your AI work will appear here
          </div>
        ) : (
          <ActivityHeatmapGrid 
            days={data.days} 
            start={range.start} 
            end={range.end} 
          />
        )}
      </div>

      <div className="mt-6 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-[3px]">
          <div className="h-[12px] w-[12px] rounded-sm aurora-cell-0" />
          <div className="h-[12px] w-[12px] rounded-sm aurora-cell-1" />
          <div className="h-[12px] w-[12px] rounded-sm aurora-cell-2" />
          <div className="h-[12px] w-[12px] rounded-sm aurora-cell-3" />
        </div>
        <span>More</span>
      </div>
    </Card>
  );
}

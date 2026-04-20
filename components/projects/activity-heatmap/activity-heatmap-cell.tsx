import { cn } from "@/lib/utils";
import { HeatmapDay } from "@/lib/types/activity";

interface ActivityHeatmapCellProps {
  day?: HeatmapDay | undefined;
  isChipped?: boolean | undefined;
}

export function ActivityHeatmapCell({ day, isChipped }: ActivityHeatmapCellProps) {
  const getIntensityClass = (count: number) => {
    if (count === 0) return "aurora-cell-0";
    if (count <= 2) return "aurora-cell-1";
    if (count <= 5) return "aurora-cell-2";
    return "aurora-cell-3";
  };

  const intensityClass = day ? getIntensityClass(day.jobCount) : "aurora-cell-0";
  const isShipped = day && day.shippedTicketCount > 0;

  return (
    <div
      className={cn(
        "h-[12px] w-[12px] rounded-sm transition-all duration-200",
        intensityClass,
        isShipped && "aurora-cell-shipped",
        isChipped && "aurora-cell-chipped"
      )}
      data-date={day?.date}
      data-jobs={day?.jobCount}
      data-shipped={day?.shippedTicketCount}
    />
  );
}

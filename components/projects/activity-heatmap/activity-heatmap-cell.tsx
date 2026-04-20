import { cn } from "@/lib/utils";
import { HeatmapDay } from "@/lib/types/activity";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format } from "date-fns";

interface ActivityHeatmapCellProps {
  day?: HeatmapDay | undefined;
  isChipped?: boolean | undefined;
}

function getIntensityClass(count: number): string {
  if (count === 0) return "aurora-cell-0";
  if (count <= 2) return "aurora-cell-1";
  if (count <= 5) return "aurora-cell-2";
  return "aurora-cell-3";
}

export function ActivityHeatmapCell({ day, isChipped }: ActivityHeatmapCellProps): JSX.Element {
  const intensityClass = getIntensityClass(day?.jobCount ?? 0);
  const isShipped = !!(day && day.shippedTicketCount > 0);

  const cell = (
    <div
      className={cn(
        "h-[12px] w-[12px] rounded-sm transition-all duration-200 cursor-default",
        intensityClass,
        isShipped && "aurora-cell-shipped",
        isChipped && "aurora-cell-chipped"
      )}
    />
  );

  if (isChipped || !day) {
    return cell;
  }

  const formattedDate = format(new Date(day.date), "EEEE, MMMM do, yyyy");

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent className="p-3 aurora-glass border-border/40 text-foreground min-w-[160px]">
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            {formattedDate}
          </p>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">AI Jobs:</span>
              <span className="font-semibold">{day.jobCount}</span>
            </div>
            {day.shippedTicketCount > 0 && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-pink-400">Shipped:</span>
                <span className="font-semibold text-pink-400">{day.shippedTicketCount}</span>
              </div>
            )}
            {day.totalCost !== null && day.totalCost > 0 && (
              <div className="flex justify-between items-center text-xs border-t border-border/30 mt-1 pt-1">
                <span className="text-muted-foreground">Estimated Cost:</span>
                <span className="font-mono text-emerald-400">
                  ${day.totalCost.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

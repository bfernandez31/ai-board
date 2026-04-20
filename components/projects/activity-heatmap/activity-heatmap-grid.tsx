"use client";

import { HeatmapDay } from "@/lib/types/activity";
import { getHeatmapGridDates, isDateInRange, formatDateKey } from "@/lib/utils/activity-date-utils";
import { ActivityHeatmapCell } from "./activity-heatmap-cell";
import { format, isSameMonth } from "date-fns";

interface ActivityHeatmapGridProps {
  days: HeatmapDay[];
  start: Date;
  end: Date;
}

export function ActivityHeatmapGrid({ days, start, end }: ActivityHeatmapGridProps) {
  const allDates = getHeatmapGridDates(start, end);
  const dayMap = new Map(days.map((d) => [d.date, d]));

  // Group dates by week (columns)
  const columns: Date[][] = [];
  let currentWeek: Date[] = [];

  allDates.forEach((date) => {
    currentWeek.push(date);
    if (currentWeek.length === 7) {
      columns.push(currentWeek);
      currentWeek = [];
    }
  });

  // Month labels logic
  const monthLabels: { label: string; colIndex: number }[] = [];
  columns.forEach((week, i) => {
    const firstDayOfWeek = week[0]!;
    if (i === 0 || !isSameMonth(firstDayOfWeek, columns[i - 1]![0]!)) {
      // Avoid overlapping labels (simple heuristic)
      if (i === 0 || i - (monthLabels[monthLabels.length - 1]?.colIndex || 0) > 2) {
        monthLabels.push({
          label: format(firstDayOfWeek, "MMM"),
          colIndex: i,
        });
      }
    }
  });

  return (
    <div className="flex flex-col gap-2">
      {/* Month Labels Container (needs to scroll with grid) */}
      <div className="flex-1 overflow-hidden ml-8">
        <div className="relative h-4 mb-1">
          {monthLabels.map((m) => (
            <div
              key={`${m.label}-${m.colIndex}`}
              className="absolute text-[10px] text-muted-foreground whitespace-nowrap"
              style={{ left: `${m.colIndex * 15}px` }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 relative">
        {/* Sticky Day Labels */}
        <div className="flex flex-col gap-[3px] text-[10px] text-muted-foreground pt-[2px] w-6 sticky left-0 z-10 bg-background/80 backdrop-blur-sm pr-1">
          <div className="h-[12px]">Sun</div>
          <div className="h-[12px]"></div>
          <div className="h-[12px]">Tue</div>
          <div className="h-[12px]"></div>
          <div className="h-[12px]">Thu</div>
          <div className="h-[12px]"></div>
          <div className="h-[12px]">Sat</div>
        </div>

        {/* The Grid Container with horizontal scroll */}
        <div className="flex-1 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex gap-[3px] min-w-max">
            {columns.map((week, colIndex) => (
              <div key={colIndex} className="flex flex-col gap-[3px]">
                {week.map((date) => {
                  const dateKey = formatDateKey(date);
                  const dayData = dayMap.get(dateKey);
                  const isChipped = !isDateInRange(date, start, end);
                  return (
                    <ActivityHeatmapCell
                      key={dateKey}
                      day={dayData}
                      isChipped={isChipped || undefined}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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

const CELL_SIZE = 12;
const CELL_GAP = 3;
const COLUMN_WIDTH = CELL_SIZE + CELL_GAP;

export function ActivityHeatmapGrid({ days, start, end }: ActivityHeatmapGridProps): JSX.Element {
  const allDates = getHeatmapGridDates(start, end);
  const dayMap = new Map(days.map((d) => [d.date, d]));

  // Group dates by week (columns)
  const columns: Date[][] = [];
  for (let i = 0; i < allDates.length; i += 7) {
    columns.push(allDates.slice(i, i + 7));
  }

  // Month labels logic
  const monthLabels: { label: string; colIndex: number }[] = [];
  columns.forEach((week, i) => {
    const firstDayOfWeek = week[0]!;
    const prevWeekFirstDay = columns[i - 1]?.[0];
    
    if (i === 0 || (prevWeekFirstDay && !isSameMonth(firstDayOfWeek, prevWeekFirstDay))) {
      // Avoid overlapping labels (minimum 2 columns apart)
      const lastLabel = monthLabels[monthLabels.length - 1];
      if (!lastLabel || i - lastLabel.colIndex > 2) {
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
              style={{ left: `${m.colIndex * COLUMN_WIDTH}px` }}
            >
              {m.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 relative">
        {/* Sticky Day Labels */}
        <div 
          className="flex flex-col text-[10px] text-muted-foreground pt-[2px] w-6 sticky left-0 z-10 bg-background/80 backdrop-blur-sm pr-1"
          style={{ gap: `${CELL_GAP}px` }}
        >
          <div style={{ height: `${CELL_SIZE}px` }}>Sun</div>
          <div style={{ height: `${CELL_SIZE}px` }}></div>
          <div style={{ height: `${CELL_SIZE}px` }}>Tue</div>
          <div style={{ height: `${CELL_SIZE}px` }}></div>
          <div style={{ height: `${CELL_SIZE}px` }}>Thu</div>
          <div style={{ height: `${CELL_SIZE}px` }}></div>
          <div style={{ height: `${CELL_SIZE}px` }}>Sat</div>
        </div>

        {/* The Grid Container with horizontal scroll */}
        <div className="flex-1 overflow-x-auto pb-2 scrollbar-hide">
          <div className="flex min-w-max" style={{ gap: `${CELL_GAP}px` }}>
            {columns.map((week, colIndex) => (
              <div key={colIndex} className="flex flex-col" style={{ gap: `${CELL_GAP}px` }}>
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

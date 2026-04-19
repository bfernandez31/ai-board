'use client';

import { useMemo } from 'react';
import { generateHeatmapGrid, getMonthLabels } from '@/lib/utils/heatmap-dates';
import { HeatmapTooltip } from './heatmap-tooltip';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HeatmapGridProps {
  data: {
    date: string;
    jobCount: number;
    totalCost: number | null;
    shippedTickets: { id: number; ticketKey: string; title: string }[];
  }[];
  range: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HeatmapGrid({ data, range }: HeatmapGridProps) {
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (range === 'last-12-months') {
      const start = new Date(now);
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0, 0, 0, 0);
      return { startDate: start, endDate: now };
    } else {
      const year = parseInt(range, 10);
      return {
        startDate: new Date(year, 0, 1),
        endDate: new Date(year, 11, 31, 23, 59, 59, 999),
      };
    }
  }, [range]);

  const grid = useMemo(() => generateHeatmapGrid(startDate, endDate), [startDate, endDate]);
  const monthLabels = useMemo(() => getMonthLabels(grid), [grid]);
  
  const dataMap = useMemo(() => {
    const map = new Map<string, typeof data[0]>();
    data.forEach((d) => map.set(d.date, d));
    return map;
  }, [data]);

  const getIntensity = (jobCount: number) => {
    if (jobCount === 0) return 0;
    if (jobCount <= 2) return 1;
    if (jobCount <= 5) return 2;
    if (jobCount <= 10) return 3;
    return 4;
  };

  const getLevelClass = (level: number) => {
    switch (level) {
      case 0: return 'bg-accent/10';
      case 1: return 'bg-ctp-mauve/20';
      case 2: return 'bg-ctp-mauve/40';
      case 3: return 'bg-ctp-mauve/70';
      case 4: return 'bg-ctp-mauve';
      default: return 'bg-accent/10';
    }
  };

  const hasActivity = data.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-x-auto pb-4 scrollbar-hide">
        <div className="flex flex-col min-w-max">
          {/* Month labels */}
          <div className="flex h-5 mb-1 ml-8">
            {monthLabels.map((label, i) => (
              <div
                key={`${label.label}-${i}`}
                className="text-[10px] text-muted-foreground absolute"
                style={{ left: `${label.weekIndex * 14 + 32}px` }}
              >
                {label.label}
              </div>
            ))}
          </div>

          <div className="flex gap-1">
            {/* Day labels */}
            <div className="flex flex-col gap-[3px] pr-2 pt-1 sticky left-0 bg-card z-10">
              {DAYS.map((day, i) => (
                <div key={day} className="h-[10px] text-[9px] text-muted-foreground leading-[10px] w-6">
                  {i % 2 === 1 ? day : ''}
                </div>
              ))}
            </div>

            {/* Grid */}
            {!hasActivity ? (
              <div className="flex flex-1 items-center justify-center min-h-[90px] text-sm text-muted-foreground italic border border-dashed border-accent/20 rounded-md">
                No activity to show yet — your AI work will appear here
              </div>
            ) : (
              <div className="flex gap-[3px]">
                <TooltipProvider delayDuration={0}>
                  {grid.map((week, weekIdx) => (
                    <div key={weekIdx} className="flex flex-col gap-[3px]">
                      {week.map((cell) => {
                        const dayData = dataMap.get(cell.date);
                        const level = dayData ? getIntensity(dayData.jobCount) : 0;
                        
                        if (!cell.isWithinPeriod) {
                          return <div key={cell.date} className="w-[10px] h-[10px]" />;
                        }

                        return (
                          <Tooltip key={cell.date}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "w-[10px] h-[10px] rounded-[1px] transition-colors",
                                  getLevelClass(level)
                                )}
                              />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="p-0 border-none">
                              <HeatmapTooltip 
                                date={cell.date} 
                                data={dayData} 
                              />
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </TooltipProvider>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center gap-2 mt-2">
        <span className="text-[10px] text-muted-foreground">Less</span>
        <div className="flex gap-[3px]">
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn("w-[10px] h-[10px] rounded-[1px]", getLevelClass(level))}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
}

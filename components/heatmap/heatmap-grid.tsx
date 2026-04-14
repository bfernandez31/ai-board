'use client';

import { HeatmapCell } from './heatmap-cell';
import { getIntensityLevel } from '@/lib/heatmap/types';
import type { HeatmapDayCell } from '@/lib/heatmap/types';

interface HeatmapGridProps {
  cells: HeatmapDayCell[];
  year: 'rolling' | number;
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

interface WeekDay {
  date: string;
  jobCount: number;
  costUsd: number | null;
  ticketsShipped: number;
}

interface Week {
  days: (WeekDay | null)[];
}

function buildGrid(cells: HeatmapDayCell[], year: 'rolling' | number): { weeks: Week[]; monthLabels: { label: string; weekIndex: number }[] } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (year === 'rolling') {
    endDate = new Date(now);
    startDate = new Date(now);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setDate(startDate.getDate() + 1);
  } else {
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 11, 31);
  }

  // Build a lookup map
  const cellMap = new Map<string, HeatmapDayCell>();
  for (const cell of cells) {
    cellMap.set(cell.date, cell);
  }

  // Align start to Sunday
  const adjustedStart = new Date(startDate);
  adjustedStart.setDate(adjustedStart.getDate() - adjustedStart.getDay());

  const weeks: Week[] = [];
  const monthLabels: { label: string; weekIndex: number }[] = [];
  const seenMonths = new Set<string>();
  const current = new Date(adjustedStart);

  while (current <= endDate || weeks.length === 0) {
    const week: Week = { days: [] };

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const dateStr = current.toISOString().slice(0, 10);
      const isInRange = current >= startDate && current <= endDate;

      if (isInRange) {
        const cell = cellMap.get(dateStr);
        week.days.push({
          date: dateStr,
          jobCount: cell?.jobCount ?? 0,
          costUsd: cell?.costUsd ?? null,
          ticketsShipped: cell?.ticketsShipped ?? 0,
        });

        // Track month labels (first day of month in week)
        const monthKey = `${current.getFullYear()}-${current.getMonth()}`;
        if (!seenMonths.has(monthKey) && current.getDate() <= 7) {
          seenMonths.add(monthKey);
          monthLabels.push({
            label: MONTH_NAMES[current.getMonth()] ?? '',
            weekIndex: weeks.length,
          });
        }
      } else {
        week.days.push(null);
      }

      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, monthLabels };
}

export function HeatmapGrid({ cells, year }: HeatmapGridProps) {
  const { weeks, monthLabels } = buildGrid(cells, year);

  // Calculate max job count for intensity scaling
  const maxCount = Math.max(1, ...cells.map((c) => c.jobCount));

  return (
    <div className="flex flex-col gap-1 min-w-max">
      {/* Month labels row */}
      <div className="flex gap-[3px]">
        <div className="w-[30px] shrink-0 sticky left-0 z-10" /> {/* Spacer for day labels */}
        {weeks.map((_, weekIdx) => {
          const monthLabel = monthLabels.find((m) => m.weekIndex === weekIdx);
          return (
            <div key={weekIdx} className="w-[13px] text-[10px] text-muted-foreground leading-none">
              {monthLabel ? monthLabel.label : ''}
            </div>
          );
        })}
      </div>

      {/* Grid rows (one per day of week: Sun=0 through Sat=6) */}
      {Array.from({ length: 7 }, (_, dayIdx) => (
        <div key={dayIdx} className="flex gap-[3px] items-center">
          <div className="w-[30px] shrink-0 text-[10px] text-muted-foreground text-right pr-1 sticky left-0 z-10">
            {DAY_LABELS[dayIdx]}
          </div>
          {weeks.map((week, weekIdx) => {
            const day = week.days[dayIdx];
            if (!day) {
              return <div key={weekIdx} className="w-[13px] h-[13px]" />;
            }
            return (
              <HeatmapCell
                key={weekIdx}
                date={day.date}
                intensity={getIntensityLevel(day.jobCount, maxCount)}
                jobCount={day.jobCount}
                costUsd={day.costUsd}
                ticketsShipped={day.ticketsShipped}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

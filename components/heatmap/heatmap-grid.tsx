import type { HeatmapDay } from '@/lib/heatmap/types';
import { computeQuartiles, getIntensityLevel } from '@/lib/heatmap/queries';

interface HeatmapGridProps {
  days: HeatmapDay[];
  startDate: Date;
  endDate: Date;
  renderTooltip?: (day: HeatmapDay | null, date: Date) => React.ReactNode;
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] as const;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatLongDate(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[date.getUTCDay()]}, ${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

interface WeekColumn {
  days: (Date | null)[];
  monthStart: string | undefined;
}

function buildGrid(startDate: Date, endDate: Date): WeekColumn[] {
  const weeks: WeekColumn[] = [];
  const current = new Date(startDate);

  // Align to start of week (Sunday)
  const startDay = current.getUTCDay();
  const weekStart = new Date(current);
  weekStart.setUTCDate(weekStart.getUTCDate() - startDay);

  const cursor = new Date(weekStart);
  let prevMonth = -1;

  while (cursor <= endDate || cursor.getUTCDay() !== 0) {
    const week: (Date | null)[] = [];
    let monthLabel: string | undefined;

    for (let dow = 0; dow < 7; dow++) {
      if (cursor < startDate || cursor > endDate) {
        week.push(null);
      } else {
        const cellDate = new Date(cursor);
        // Track month transitions for labels
        if (cellDate.getUTCMonth() !== prevMonth && dow <= 3) {
          monthLabel = MONTH_NAMES[cellDate.getUTCMonth()];
          prevMonth = cellDate.getUTCMonth();
        }
        week.push(cellDate);
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    weeks.push({ days: week, monthStart: monthLabel });

    // Break if we've gone past endDate and completed the week
    if (cursor > endDate) break;
  }

  return weeks;
}

const CELL_SIZE = 12;
const CELL_GAP = 3;

export function HeatmapGrid({ days, startDate, endDate, renderTooltip }: HeatmapGridProps) {
  const dayMap = new Map<string, HeatmapDay>();
  for (const day of days) {
    dayMap.set(day.date, day);
  }

  const jobCounts = days.map((d) => d.jobCount);
  const quartiles = computeQuartiles(jobCounts);
  const weeks = buildGrid(startDate, endDate);

  return (
    <div className="overflow-x-auto" role="grid" aria-label="Activity heatmap">
      <div className="inline-flex">
        {/* Day-of-week labels */}
        <div
          className="sticky left-0 z-10 flex flex-col bg-background pr-2"
          style={{ gap: `${CELL_GAP}px`, paddingTop: `${CELL_SIZE + CELL_GAP + 4}px` }}
        >
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="text-[10px] text-muted-foreground leading-none flex items-center"
              style={{ height: `${CELL_SIZE}px` }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Grid columns */}
        <div>
          {/* Month labels row */}
          <div className="flex" style={{ gap: `${CELL_GAP}px`, marginBottom: `${CELL_GAP + 4}px` }}>
            {weeks.map((week, wi) => (
              <div
                key={wi}
                className="text-[10px] text-muted-foreground leading-none"
                style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
              >
                {week.monthStart ?? ''}
              </div>
            ))}
          </div>

          {/* Cell rows (7 rows for Sun-Sat) */}
          {Array.from({ length: 7 }, (_, row) => (
            <div key={row} className="flex" style={{ gap: `${CELL_GAP}px`, marginBottom: row < 6 ? `${CELL_GAP}px` : '0' }}>
              {weeks.map((week, wi) => {
                const cellDate = week.days[row] ?? null;
                if (!cellDate) {
                  return (
                    <div
                      key={wi}
                      style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                    />
                  );
                }

                const dateKey = formatDateUTC(cellDate);
                const dayData = dayMap.get(dateKey) ?? null;
                const level = dayData ? getIntensityLevel(dayData.jobCount, quartiles) : 0;
                const ariaLabel = dayData
                  ? `${dayData.jobCount} jobs on ${formatLongDate(cellDate)}`
                  : `No activity on ${formatLongDate(cellDate)}`;

                const cell = (
                  <div
                    key={wi}
                    className={`heatmap-level-${level} rounded-sm`}
                    style={{ width: `${CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
                    role="gridcell"
                    aria-label={ariaLabel}
                  />
                );

                if (renderTooltip) {
                  return renderTooltip(dayData, cellDate);
                }

                return cell;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { formatLongDate, formatDateUTC as formatDateKey };

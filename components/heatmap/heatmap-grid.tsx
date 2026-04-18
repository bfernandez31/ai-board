'use client';

import { useMemo, useState, useCallback } from 'react';
import type { HeatmapCell } from '@/lib/heatmap/types';
import { HeatmapTooltip } from './heatmap-tooltip';

interface HeatmapGridProps {
  cells: HeatmapCell[];
  thresholds: [number, number, number, number];
  startDate: string;
  endDate: string;
}

const DAY_LABELS = ['Mon', 'Wed', 'Fri'] as const;
const DAY_LABEL_ROWS = [1, 3, 5] as const;

function getIntensityLevel(jobCount: number, thresholds: [number, number, number, number]): number {
  if (jobCount === 0) return 0;
  if (jobCount <= thresholds[0]) return 1;
  if (jobCount <= thresholds[1]) return 2;
  if (jobCount <= thresholds[2]) return 3;
  return 4;
}

const INTENSITY_CLASSES = [
  'bg-muted/30',
  'bg-violet-400/30',
  'bg-violet-400/50',
  'bg-violet-400/75',
  'bg-violet-400',
] as const;

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

interface GridCell {
  date: string;
  dayOfWeek: number;
  weekIndex: number;
  data: HeatmapCell | null;
}

function buildGrid(startDate: string, endDate: string, cells: HeatmapCell[]) {
  const cellMap = new Map(cells.map((c) => [c.date, c]));
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  const startDow = start.getUTCDay();
  const endDow = end.getUTCDay();

  const gridCells: GridCell[] = [];
  const monthLabels: { label: string; weekIndex: number }[] = [];

  let weekIndex = 0;
  let lastMonth = -1;
  const current = new Date(start);

  while (current <= end) {
    const dow = current.getUTCDay();
    const dateStr = current.toISOString().split('T')[0]!;
    const month = current.getUTCMonth();

    if (month !== lastMonth) {
      monthLabels.push({ label: formatMonthLabel(current), weekIndex });
      lastMonth = month;
    }

    gridCells.push({
      date: dateStr,
      dayOfWeek: dow,
      weekIndex,
      data: cellMap.get(dateStr) ?? null,
    });

    current.setUTCDate(current.getUTCDate() + 1);
    if (current.getUTCDay() === 0 && current <= end) {
      weekIndex++;
    }
  }

  const totalWeeks = weekIndex + 1;

  return { gridCells, monthLabels, totalWeeks, startDow, endDow };
}

export function HeatmapGrid({ cells, thresholds, startDate, endDate }: HeatmapGridProps) {
  const [activeTooltip, setActiveTooltip] = useState<{ cell: GridCell; rect: DOMRect } | null>(null);

  const { gridCells, monthLabels, totalWeeks, startDow, endDow } = useMemo(
    () => buildGrid(startDate, endDate, cells),
    [startDate, endDate, cells]
  );

  const handleCellInteraction = useCallback((cell: GridCell, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setActiveTooltip((prev) => {
      if (prev?.cell.date === cell.date) return null;
      return { cell, rect };
    });
  }, []);

  const handleDismiss = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, cell: GridCell, element: HTMLElement) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCellInteraction(cell, element);
    }
  }, [handleCellInteraction]);

  const labelWidth = 32;

  return (
    <div className="relative" data-testid="heatmap-grid">
      <div className="overflow-x-auto">
        <div style={{ display: 'inline-block', minWidth: 'fit-content' }}>
          {/* Month labels */}
          <div className="flex" style={{ paddingLeft: `${labelWidth + 4}px`, marginBottom: '4px' }}>
            {monthLabels.map((m, i) => {
              const nextStart = monthLabels[i + 1]?.weekIndex ?? totalWeeks;
              const span = nextStart - m.weekIndex;
              return (
                <span
                  key={`${m.label}-${m.weekIndex}`}
                  className="text-xs text-muted-foreground"
                  style={{ width: `${span * 15}px`, flexShrink: 0 }}
                  data-testid="month-label"
                >
                  {span >= 2 ? m.label : ''}
                </span>
              );
            })}
          </div>

          <div className="flex">
            {/* Day-of-week labels */}
            <div
              className="sticky left-0 z-10 flex-shrink-0"
              style={{ width: `${labelWidth}px` }}
            >
              <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 13px)', gap: '2px' }}>
                {Array.from({ length: 7 }, (_, row) => {
                  const labelIdx = DAY_LABEL_ROWS.indexOf(row as 1 | 3 | 5);
                  return (
                    <div key={row} className="flex items-center">
                      {labelIdx >= 0 && (
                        <span className="text-xs text-muted-foreground" data-testid="day-label">
                          {DAY_LABELS[labelIdx]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid cells */}
            <div
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(7, 13px)',
                gridAutoFlow: 'column',
                gridAutoColumns: '13px',
                gap: '2px',
              }}
              data-testid="heatmap-cells"
            >
              {Array.from({ length: totalWeeks }, (_, weekIdx) =>
                Array.from({ length: 7 }, (_, dow) => {
                  const isChippedStart = weekIdx === 0 && dow < startDow;
                  const isChippedEnd = weekIdx === totalWeeks - 1 && dow > endDow;

                  if (isChippedStart || isChippedEnd) {
                    return <div key={`${weekIdx}-${dow}`} />;
                  }

                  const cell = gridCells.find(
                    (c) => c.weekIndex === weekIdx && c.dayOfWeek === dow
                  );

                  if (!cell) return <div key={`${weekIdx}-${dow}`} />;

                  const level = getIntensityLevel(cell.data?.jobCount ?? 0, thresholds);

                  return (
                    <div
                      key={cell.date}
                      className={`rounded-sm ${INTENSITY_CLASSES[level]} cursor-pointer`}
                      style={{ width: '13px', height: '13px', padding: '0', minWidth: '11px', minHeight: '11px' }}
                      data-testid="heatmap-cell"
                      data-date={cell.date}
                      data-level={level}
                      tabIndex={0}
                      role="button"
                      aria-label={`${cell.date}: ${cell.data?.jobCount ?? 0} jobs`}
                      onMouseEnter={(e) => handleCellInteraction(cell, e.currentTarget)}
                      onMouseLeave={handleDismiss}
                      onClick={(e) => handleCellInteraction(cell, e.currentTarget)}
                      onKeyDown={(e) => handleKeyDown(e, cell, e.currentTarget)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {activeTooltip && (
        <HeatmapTooltip
          date={activeTooltip.cell.date}
          data={activeTooltip.cell.data}
          rect={activeTooltip.rect}
          onDismiss={handleDismiss}
        />
      )}
    </div>
  );
}

export { getIntensityLevel, buildGrid };

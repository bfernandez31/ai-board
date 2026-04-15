'use client';

import { useMemo, useState, useRef, useCallback } from 'react';
import type { HeatmapCell } from '@/lib/heatmap/types';
import { getDayLabels, getMonthLabels } from '@/lib/heatmap/utils';
import type { MonthLabel } from '@/lib/heatmap/utils';
import { HeatmapTooltip } from './heatmap-tooltip';

const INTENSITY_CLASSES = [
  'bg-muted',
  'bg-primary/20',
  'bg-primary/40',
  'bg-primary/60',
  'bg-primary/80',
] as const;

interface HeatmapGridProps {
  grid: (HeatmapCell | null)[][];
  periodStart: Date;
  periodEnd: Date;
}

export function HeatmapGrid({ grid, periodStart, periodEnd }: HeatmapGridProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const monthLabels = useMemo(() => getMonthLabels(periodStart, periodEnd), [periodStart, periodEnd]);
  const dayLabels = getDayLabels();
  const numCols = grid[0]?.length ?? 0;

  const handleCellEnter = useCallback(
    (cell: HeatmapCell, event: React.MouseEvent<HTMLDivElement>) => {
      setHoveredCell(cell);
      const rect = event.currentTarget.getBoundingClientRect();
      const gridRect = gridRef.current?.getBoundingClientRect();
      if (gridRect) {
        setTooltipPos({
          x: rect.left - gridRect.left + rect.width / 2,
          y: rect.top - gridRect.top,
        });
      }
    },
    []
  );

  const handleCellLeave = useCallback(() => {
    setHoveredCell(null);
    setTooltipPos(null);
  }, []);

  const handleCellTap = useCallback(
    (cell: HeatmapCell, event: React.TouchEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (hoveredCell?.date.getTime() === cell.date.getTime()) {
        setHoveredCell(null);
        setTooltipPos(null);
        return;
      }
      setHoveredCell(cell);
      const rect = event.currentTarget.getBoundingClientRect();
      const gridRect = gridRef.current?.getBoundingClientRect();
      if (gridRect) {
        setTooltipPos({
          x: rect.left - gridRect.left + rect.width / 2,
          y: rect.top - gridRect.top,
        });
      }
    },
    [hoveredCell]
  );

  return (
    <div className="relative" ref={gridRef}>
      <div data-testid="heatmap-scroll-container" className="overflow-x-auto">
        <div className="inline-flex gap-0">
          {/* Day labels column */}
          <div className="flex flex-col gap-0 mr-1 flex-shrink-0">
            <div className="h-[18px]" /> {/* Space for month labels */}
            {[0, 1, 2, 3, 4, 5, 6].map((row) => {
              const label = dayLabels.find((l) => l.row === row);
              return (
                <div
                  key={row}
                  data-testid={label ? 'day-label' : undefined}
                  className={`h-[14px] mb-[2px] flex items-center text-[10px] text-muted-foreground pr-1 sticky left-0 bg-background z-10 ${label ? 'sticky' : ''}`}
                >
                  {label?.text ?? ''}
                </div>
              );
            })}
          </div>

          {/* Grid area */}
          <div className="relative">
            {/* Month labels */}
            <div className="flex h-[18px] relative">
              {monthLabels.map((label: MonthLabel, i: number) => (
                <span
                  key={`${label.text}-${i}`}
                  className="absolute text-[10px] text-muted-foreground"
                  style={{ left: `${label.column * 16}px` }}
                >
                  {label.text}
                </span>
              ))}
            </div>

            {/* Cell grid */}
            <div
              className="grid gap-[2px]"
              style={{
                gridTemplateRows: 'repeat(7, 14px)',
                gridTemplateColumns: `repeat(${numCols}, 14px)`,
              }}
            >
              {Array.from({ length: numCols }, (_, col) =>
                Array.from({ length: 7 }, (_, row) => {
                  const cell = grid[row]?.[col];
                  if (cell === null || cell === undefined) {
                    return (
                      <div
                        key={`${row}-${col}`}
                        style={{ gridRow: row + 1, gridColumn: col + 1 }}
                      />
                    );
                  }

                  return (
                    <div
                      key={`${row}-${col}`}
                      data-testid="heatmap-cell"
                      data-level={cell.level}
                      data-date={cell.date.toISOString().slice(0, 10)}
                      className={`w-[14px] h-[14px] rounded-sm ${INTENSITY_CLASSES[cell.level]} cursor-pointer transition-colors hover:ring-1 hover:ring-foreground/30`}
                      style={{ gridRow: row + 1, gridColumn: col + 1 }}
                      onMouseEnter={(e) => handleCellEnter(cell, e)}
                      onMouseLeave={handleCellLeave}
                      onTouchStart={(e) => handleCellTap(cell, e)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {hoveredCell && tooltipPos && (
        <HeatmapTooltip cell={hoveredCell} position={tooltipPos} />
      )}
    </div>
  );
}

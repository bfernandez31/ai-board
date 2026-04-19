'use client';

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { DailyCell } from '@/lib/analytics/heatmap-types';

const BUCKET_CLASSES = [
  'aurora-heatmap-bucket-0',
  'aurora-heatmap-bucket-1',
  'aurora-heatmap-bucket-2',
  'aurora-heatmap-bucket-3',
  'aurora-heatmap-bucket-4',
] as const;

interface ActivityHeatmapCellProps {
  cell: DailyCell;
  column: number;
  row: number;
}

function useTouchOnlyViewport(): boolean {
  const [isTouchOnly, setIsTouchOnly] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(hover: none)');
    const update = (): void => setIsTouchOnly(mql.matches);
    update();
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', update);
      return () => mql.removeEventListener('change', update);
    }
    return undefined;
  }, []);
  return isTouchOnly;
}

function formatTooltipDate(dateKey: string): string {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return dateKey;
  const [y, m, d] = parts;
  const date = new Date(
    Date.UTC(Number.parseInt(y!, 10), Number.parseInt(m!, 10) - 1, Number.parseInt(d!, 10))
  );
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

function CellContent({ cell, column, row }: ActivityHeatmapCellProps): ReactElement {
  const bucketClass = BUCKET_CLASSES[cell.bucket];
  return (
    <div
      role="gridcell"
      aria-label={`${cell.date}: ${cell.jobCount} jobs`}
      data-date={cell.date}
      data-bucket={cell.bucket}
      className={`${bucketClass} rounded-sm cursor-default`}
      style={{
        gridColumn: column,
        gridRow: row,
        minHeight: 14,
        minWidth: 14,
      }}
    />
  );
}

function TooltipBody({ cell }: { cell: DailyCell }): ReactElement {
  const dateLabel = useMemo(() => formatTooltipDate(cell.date), [cell.date]);
  const shipLine = pluralize(cell.shippedTicketCount, 'ticket shipped', 'tickets shipped');
  const jobsLabel = pluralize(cell.jobCount, 'job', 'jobs');
  const showCost = cell.totalCostUsd !== null && cell.totalCostUsd !== undefined;
  return (
    <div className="text-xs space-y-0.5">
      <div className="font-semibold">{dateLabel}</div>
      <div>{shipLine}</div>
      <div>
        {jobsLabel}
        {showCost ? ` · ${formatCost(cell.totalCostUsd as number)}` : ''}
      </div>
    </div>
  );
}

export function ActivityHeatmapCell(props: ActivityHeatmapCellProps): ReactElement {
  const isTouchOnly = useTouchOnlyViewport();
  const { cell } = props;

  if (isTouchOnly) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${cell.date}: ${cell.jobCount} jobs`}
            className="appearance-none border-0 p-0 bg-transparent"
            style={{ gridColumn: props.column, gridRow: props.row }}
          >
            <CellContent {...props} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <TooltipBody cell={cell} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${cell.date}: ${cell.jobCount} jobs`}
          className="appearance-none border-0 p-0 bg-transparent"
          style={{ gridColumn: props.column, gridRow: props.row }}
        >
          <CellContent {...props} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="p-2">
        <TooltipBody cell={cell} />
      </TooltipContent>
    </Tooltip>
  );
}

export { BUCKET_CLASSES };

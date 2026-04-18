'use client';

import { useEffect, useRef } from 'react';
import type { HeatmapCell } from '@/lib/heatmap/types';

interface HeatmapTooltipProps {
  date: string;
  data: HeatmapCell | null;
  rect: DOMRect;
  onDismiss: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

export function HeatmapTooltip({ date, data, rect, onDismiss }: HeatmapTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onDismiss]);

  const hasActivity = data && data.jobCount > 0;
  const left = rect.left + rect.width / 2;
  const top = rect.top - 8;

  return (
    <div
      ref={ref}
      className="fixed z-50 rounded-md border bg-popover px-3 py-2 text-sm shadow-md"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        transform: 'translate(-50%, -100%)',
        maxWidth: '220px',
      }}
      role="tooltip"
      data-testid="heatmap-tooltip"
    >
      {hasActivity ? (
        <div className="space-y-0.5">
          {data.shippedCount > 0 && (
            <p className="text-foreground font-medium" data-testid="tooltip-shipped">
              {data.shippedCount} {data.shippedCount === 1 ? 'ticket' : 'tickets'} shipped
            </p>
          )}
          <p className="text-foreground" data-testid="tooltip-jobs">
            {data.jobCount} {data.jobCount === 1 ? 'job' : 'jobs'}
            {data.totalCost != null && ` · ${formatCost(data.totalCost)}`}
          </p>
          <p className="text-muted-foreground" data-testid="tooltip-date">{formatDate(date)}</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          <p className="text-muted-foreground" data-testid="tooltip-empty">No activity</p>
          <p className="text-muted-foreground" data-testid="tooltip-date">{formatDate(date)}</p>
        </div>
      )}
    </div>
  );
}

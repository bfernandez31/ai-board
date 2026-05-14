'use client';

import type { ReactElement } from 'react';

export interface ChartTooltipRow {
  label: string;
  value: string | number;
  color?: string;
}

interface ChartTooltipContentProps {
  title: string;
  rows: ChartTooltipRow[];
}

export function ChartTooltipContent({ title, rows }: ChartTooltipContentProps) {
  return (
    <div
      data-testid="chart-tooltip"
      className="rounded-lg border border-border/60 bg-popover/95 px-3 py-2 text-popover-foreground shadow-lg backdrop-blur-sm"
    >
      <div className="mb-1 text-xs font-semibold text-foreground">{title}</div>
      <div className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {row.color && (
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: row.color }}
                />
              )}
              {row.label}
            </span>
            <span className="tabular-nums font-medium text-foreground">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RechartsTooltipRenderProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

export function renderChartTooltip<T>(
  build: (point: T) => { title: string; rows: ChartTooltipRow[] }
): (props: RechartsTooltipRenderProps) => ReactElement | null {
  return function RenderChartTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const point = payload[0]?.payload as T | undefined;
    if (!point) return null;
    const { title, rows } = build(point);
    return <ChartTooltipContent title={title} rows={rows} />;
  };
}

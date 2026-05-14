'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import type { MrrMonthPoint } from '@/lib/admin/home/types';
import { ChartTooltipContent } from './chart-tooltip';

interface MrrTrendProps {
  data: MrrMonthPoint[];
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function MrrTrend({ data }: MrrTrendProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        No MRR data yet
      </div>
    );
  }

  return (
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <XAxis dataKey="m" hide />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--ctp-mauve) / 0.4)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as MrrMonthPoint | undefined;
              if (!point) return null;
              return (
                <ChartTooltipContent
                  title={point.m}
                  rows={[
                    {
                      label: 'MRR',
                      value: formatUsd(point.v),
                      color: 'hsl(var(--chart-1))',
                    },
                  ]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke="hsl(var(--chart-1))"
            fill="hsl(var(--chart-1))"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

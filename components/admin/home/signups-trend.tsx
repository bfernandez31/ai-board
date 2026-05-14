'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from 'recharts';
import type { TrendPoint } from '@/lib/admin/home/types';
import { ChartTooltipContent } from './chart-tooltip';

interface SignupsTrendProps {
  data: TrendPoint[];
}

export function SignupsTrend({ data }: SignupsTrendProps) {
  const allZero = data.every((p) => p.v === 0);

  if (allZero) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        No signups yet
      </div>
    );
  }

  return (
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="d" hide />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--ctp-mauve) / 0.4)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as TrendPoint | undefined;
              if (!point) return null;
              return (
                <ChartTooltipContent
                  title={point.d}
                  rows={[
                    {
                      label: 'Signups',
                      value: point.v,
                      color: 'hsl(var(--chart-1))',
                    },
                  ]}
                />
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="v"
            dot={false}
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from 'recharts';
import type { JobTrendPoint } from '@/lib/admin/home/types';
import { ChartTooltipContent } from './chart-tooltip';

interface JobsTrendProps {
  data: JobTrendPoint[];
}

export function JobsTrend({ data }: JobsTrendProps) {
  const allZero = data.every((p) => p.completed === 0 && p.failed === 0);

  if (allZero) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        No jobs yet
      </div>
    );
  }

  return (
    <div className="h-24">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <XAxis dataKey="d" hide />
          <Tooltip
            cursor={{ fill: 'hsl(var(--ctp-mauve) / 0.12)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload as JobTrendPoint | undefined;
              if (!point) return null;
              return (
                <ChartTooltipContent
                  title={point.d}
                  rows={[
                    {
                      label: 'Completed',
                      value: point.completed,
                      color: 'hsl(var(--chart-2))',
                    },
                    {
                      label: 'Failed',
                      value: point.failed,
                      color: 'hsl(var(--chart-3))',
                    },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="completed" stackId="a" fill="hsl(var(--chart-2))" />
          <Bar dataKey="failed" stackId="a" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

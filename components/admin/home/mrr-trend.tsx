'use client';

import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import type { MrrMonthPoint } from '@/lib/admin/home/types';

interface MrrTrendProps {
  data: MrrMonthPoint[];
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
          <Tooltip />
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

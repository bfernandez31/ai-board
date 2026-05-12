'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, Tooltip } from 'recharts';
import type { TrendPoint } from '@/lib/admin/home/types';

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
          <Tooltip />
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

'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TrendDataPoint } from '@/lib/health/types';

interface ScoreTrendChartProps {
  data: TrendDataPoint[];
}

export function ScoreTrendChart({ data }: ScoreTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) =>
            new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          }
          className="text-[10px]"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          domain={[0, 100]}
          className="text-[10px]"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <Tooltip
          labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
          formatter={(value) => [`${value}`, 'Score']}
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
          }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary) / 0.1)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

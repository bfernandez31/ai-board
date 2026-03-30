'use client';

import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Area,
} from 'recharts';
import type { TrendDataPoint } from '@/lib/health/types';

interface ModuleAreaChartProps {
  data: TrendDataPoint[];
}

export function ModuleAreaChart({ data }: ModuleAreaChartProps) {
  if (data.length < 2) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-muted-foreground">Not enough data for trend chart</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Score Trend</h3>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(v: string) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
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
      </div>
    </div>
  );
}

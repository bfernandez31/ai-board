'use client';

import { ResponsiveContainer, LineChart, Line } from 'recharts';
import type { TrendDataPoint } from '@/lib/health/types';

interface SparklineProps {
  data: TrendDataPoint[];
}

export function Sparkline({ data }: SparklineProps) {
  if (data.length < 3) return null;

  return (
    <div className="h-10 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="score"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

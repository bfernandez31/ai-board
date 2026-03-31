'use client';

import { ResponsiveContainer, LineChart, Line } from 'recharts';
import type { TrendDataPoint } from '@/lib/health/types';

interface SparklineProps {
  data: TrendDataPoint[];
  color?: string;
}

export function Sparkline({ data, color = 'hsl(var(--primary))' }: SparklineProps) {
  if (data.length < 3) return null;

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="score"
          stroke={color}
          dot={false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

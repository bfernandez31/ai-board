'use client';

import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface KpiSparklineProps {
  data: number[];
  ariaLabel?: string;
}

export function KpiSparkline({ data, ariaLabel }: KpiSparklineProps) {
  const chartData = data.map((value, index) => ({ index, value }));
  return (
    <div role="img" aria-label={ariaLabel ?? 'sparkline'} className="h-10 w-full">
      <ResponsiveContainer width="100%" height={40}>
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--chart-1))"
            dot={false}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

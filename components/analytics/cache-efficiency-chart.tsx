'use client';

import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { CacheEfficiency } from '@/lib/analytics/types';

interface CacheEfficiencyChartProps {
  data: CacheEfficiency;
}

const COLORS = {
  cached: 'hsl(var(--chart-3))',
  fresh: 'hsl(var(--chart-1))',
};

export function CacheEfficiencyChart({ data }: CacheEfficiencyChartProps) {
  const chartData = [
    {
      name: 'Cached',
      value: data.cacheReadTokens,
    },
    {
      name: 'Fresh',
      value: data.freshInputTokens,
    },
  ];

  if (data.totalInputTokens === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cache Efficiency</CardTitle>
          <CardDescription>Input token cache hit rate</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cache Efficiency</CardTitle>
        <CardDescription>
          {data.efficiencyPercent.toFixed(1)}% of input tokens served from cache
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              fill="#8884d8"
              dataKey="value"
              label={(entry) => `${entry.name}: ${((entry.value / data.totalInputTokens) * 100).toFixed(1)}%`}
            >
              {chartData.map((_entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={index === 0 ? COLORS.cached : COLORS.fresh}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => value.toLocaleString()}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

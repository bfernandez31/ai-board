'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TokenUsage } from '@/lib/analytics/types';

interface TokenUsageChartProps {
  data: TokenUsage;
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  const chartData = [
    {
      name: 'Token Usage',
      'Input Tokens': data.inputTokens,
      'Output Tokens': data.outputTokens,
      'Cache Read': data.cacheReadTokens,
      'Cache Creation': data.cacheCreationTokens,
    },
  ];

  if (data.totalTokens === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Token Usage</CardTitle>
          <CardDescription>Token consumption breakdown</CardDescription>
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
        <CardTitle>Token Usage</CardTitle>
        <CardDescription>Token consumption breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip
              formatter={(value: number) => value.toLocaleString()}
            />
            <Legend />
            <Bar dataKey="Input Tokens" stackId="a" fill="hsl(var(--chart-1))" />
            <Bar dataKey="Output Tokens" stackId="a" fill="hsl(var(--chart-2))" />
            <Bar dataKey="Cache Read" stackId="a" fill="hsl(var(--chart-3))" />
            <Bar dataKey="Cache Creation" stackId="a" fill="hsl(var(--chart-4))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

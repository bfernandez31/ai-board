'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { TokenBreakdown } from '@/lib/analytics/types';
import { formatAbbreviatedNumber } from '@/lib/analytics/aggregations';

interface TokenUsageChartProps {
  data: TokenBreakdown;
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  const chartData = [
    { name: 'Input', tokens: data.inputTokens, fill: 'hsl(var(--chart-1))' },
    { name: 'Output', tokens: data.outputTokens, fill: 'hsl(var(--chart-2))' },
    { name: 'Cache', tokens: data.cacheTokens, fill: 'hsl(var(--chart-3))' },
  ];

  const total = data.inputTokens + data.outputTokens + data.cacheTokens;

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Token Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No token data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Token Usage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
              <XAxis
                dataKey="name"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                tickFormatter={(value) => formatAbbreviatedNumber(value)}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={50}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0];
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item?.payload?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatAbbreviatedNumber(item?.value as number)} tokens
                      </p>
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar dataKey="tokens" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

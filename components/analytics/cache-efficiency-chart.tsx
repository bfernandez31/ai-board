'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { CacheMetrics } from '@/lib/analytics/types';
import { formatAbbreviatedNumber, formatCost, formatPercentage } from '@/lib/analytics/aggregations';

interface CacheEfficiencyChartProps {
  data: CacheMetrics;
  emptyMessage?: string;
}

export function CacheEfficiencyChart({
  data,
  emptyMessage = 'No cache data available',
}: CacheEfficiencyChartProps) {
  const chartData = [
    { name: 'Cache', value: data.cacheTokens, color: 'hsl(var(--chart-5))' },
    { name: 'Non-Cache', value: data.totalTokens - data.cacheTokens, color: 'hsl(var(--chart-4))' },
  ];

  if (data.totalTokens === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">Cache Efficiency</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-foreground">Cache Efficiency</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatAbbreviatedNumber(item.value)} tokens
                      </p>
                    </div>
                  );
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-center space-y-1">
          <p className="text-2xl font-bold">{formatPercentage(data.savingsPercentage)}</p>
          <p className="text-sm text-muted-foreground">
            Cache hit rate • Est. savings: {formatCost(data.estimatedSavingsUsd)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

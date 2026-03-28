'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { CostDataPoint } from '@/lib/analytics/types';
import { formatCost } from '@/lib/analytics/aggregations';

interface CostOverTimeChartProps {
  data: CostDataPoint[];
  emptyMessage?: string;
}

export function CostOverTimeChart({ data, emptyMessage = 'No cost data available' }: CostOverTimeChartProps) {
  if (data.length === 0) {
    return (
      <Card className="aurora-bg-subtle">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Cost Over Time</CardTitle>
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
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Cost Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 10, right: 10 }}>
              <defs>
                <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => {
                  if (value.includes('W')) {
                    return value.split('-')[1] ?? value;
                  }
                  const parts = value.split('-');
                  return `${parts[1]}/${parts[2]}`;
                }}
              />
              <YAxis
                tickFormatter={(value) => formatCost(value)}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={60}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as CostDataPoint;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.date}</p>
                      <p className="text-sm text-muted-foreground">Cost: {formatCost(item.cost)}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#costGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

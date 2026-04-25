'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { PeakContextDistributionBucket } from '@/lib/analytics/types';

interface ContextPeakDistributionChartProps {
  data: PeakContextDistributionBucket[];
  emptyMessage?: string;
}

export function ContextPeakDistributionChart({
  data,
  emptyMessage = 'No context distribution data available',
}: ContextPeakDistributionChartProps) {
  if (data.length === 0) {
    return (
      <Card className="aurora-bg-subtle">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Peak Context Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Peak Context Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as PeakContextDistributionBucket;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.jobCount} jobs</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="jobCount" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

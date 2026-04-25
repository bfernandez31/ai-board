'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { QualityBucketContextSummary } from '@/lib/analytics/types';
import { formatContextSize } from '@/lib/analytics/context-metrics';

interface ContextQualityBucketChartProps {
  data: QualityBucketContextSummary[];
  emptyMessage?: string;
}

export function ContextQualityBucketChart({
  data,
  emptyMessage = 'No context-by-quality comparisons available',
}: ContextQualityBucketChartProps) {
  if (data.length === 0) {
    return (
      <Card className="aurora-bg-subtle">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Context by Quality Bucket</CardTitle>
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
        <CardTitle className="text-base text-foreground">Context by Quality Bucket</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="bucket" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => formatContextSize(value).replace(' tokens', '')}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as QualityBucketContextSummary;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.bucket}</p>
                      <p className="text-sm text-muted-foreground">
                        Avg peak: {formatContextSize(item.averagePeakContextSize)}
                      </p>
                      <p className="text-sm text-muted-foreground">{item.jobCount} jobs</p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="averagePeakContextSize"
                fill="hsl(var(--chart-4))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

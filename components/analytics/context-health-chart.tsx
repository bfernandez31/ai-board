'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ContextBucket } from '@/lib/analytics/types';

interface ContextHealthChartProps {
  data: ContextBucket[];
  emptyMessage?: string;
}

const BUCKET_COLORS: Record<string, string> = {
  '0–25K': 'hsl(var(--chart-2))',
  '25–50K': 'hsl(var(--chart-2))',
  '50–75K': 'hsl(var(--chart-3))',
  '75–100K': 'hsl(var(--chart-3))',
  '100–150K': 'hsl(var(--chart-1))',
  '150K+': 'hsl(var(--chart-1))',
};

export function ContextHealthChart({
  data,
  emptyMessage = 'No context health data available',
}: ContextHealthChartProps) {
  if (data.length === 0) {
    return (
      <Card className="aurora-bg-subtle">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Context Health Distribution</CardTitle>
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
        <CardTitle className="text-base text-foreground">Context Health Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 10, right: 20 }}>
              <XAxis
                dataKey="bucket"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as ContextBucket;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.bucket} tokens</p>
                      <p className="text-sm text-muted-foreground">
                        {item.count} {item.count === 1 ? 'job' : 'jobs'}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.bucket} fill={BUCKET_COLORS[entry.bucket] ?? 'hsl(var(--chart-1))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

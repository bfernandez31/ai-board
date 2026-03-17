'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { QualityScoreDataPoint } from '@/lib/analytics/types';

interface QualityScoreChartProps {
  data: QualityScoreDataPoint[];
  emptyMessage?: string;
}

export function QualityScoreChart({ data, emptyMessage = 'No quality score data' }: QualityScoreChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">Quality Score Over Time</CardTitle>
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
        <CardTitle className="text-base text-foreground">Quality Score Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 10, right: 10 }}>
              <defs>
                <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
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
                domain={[0, 100]}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={40}
              />
              <ReferenceLine
                y={90}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
              <ReferenceLine
                y={70}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.3}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as QualityScoreDataPoint;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.date}</p>
                      <p className="text-sm text-muted-foreground">
                        Avg Score: {item.avgScore} ({item.count} review{item.count !== 1 ? 's' : ''})
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="avgScore"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#qualityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

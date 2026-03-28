'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { WeeklyVelocity } from '@/lib/analytics/types';

interface VelocityChartProps {
  data: WeeklyVelocity[];
  emptyMessage?: string;
}

export function VelocityChart({
  data,
  emptyMessage = 'No velocity data available',
}: VelocityChartProps) {
  if (data.length === 0) {
    return (
      <Card className="aurora-bg-subtle">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Velocity</CardTitle>
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
        <CardTitle className="text-base text-foreground">Velocity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 10, right: 10 }}>
              <XAxis
                dataKey="week"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => value.split('-')[1] ?? value}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as WeeklyVelocity;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.week}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.ticketsShipped} tickets shipped
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="ticketsShipped" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

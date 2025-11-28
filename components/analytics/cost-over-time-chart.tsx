'use client';

import { useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CostOverTimeDataPoint } from '@/lib/analytics/types';

interface CostOverTimeChartProps {
  data: CostOverTimeDataPoint[];
}

export function CostOverTimeChart({ data }: CostOverTimeChartProps) {
  const [granularity, setGranularity] = useState<'daily' | 'weekly'>('daily');

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Over Time</CardTitle>
          <CardDescription>Daily cost trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Aggregate by week if weekly granularity selected
  const chartData = granularity === 'daily' ? data : aggregateByWeek(data);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cost Over Time</CardTitle>
            <CardDescription>
              {granularity === 'daily' ? 'Daily' : 'Weekly'} cost trends
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={granularity === 'daily' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGranularity('daily')}
            >
              Daily
            </Button>
            <Button
              variant={granularity === 'weekly' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGranularity('weekly')}
            >
              Weekly
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(date) =>
                new Date(date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }
            />
            <YAxis />
            <Tooltip
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
              labelFormatter={(date) =>
                new Date(date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              }
            />
            <Area
              type="monotone"
              dataKey="costUsd"
              stroke="hsl(var(--primary))"
              fill="url(#costGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function aggregateByWeek(data: CostOverTimeDataPoint[]): CostOverTimeDataPoint[] {
  const weekMap = new Map<string, { cost: number; count: number }>();

  for (const point of data) {
    const weekStart = getISOWeekStart(point.date);
    const weekKey = weekStart.toISOString();
    const existing = weekMap.get(weekKey) || { cost: 0, count: 0 };
    weekMap.set(weekKey, {
      cost: existing.cost + point.costUsd,
      count: existing.count + point.jobCount,
    });
  }

  return Array.from(weekMap.entries())
    .map(([weekKey, { cost, count }]) => ({
      date: new Date(weekKey),
      costUsd: cost,
      jobCount: count,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

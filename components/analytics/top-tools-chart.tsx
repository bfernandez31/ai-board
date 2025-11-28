'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { TopToolDataPoint } from '@/lib/analytics/types';

interface TopToolsChartProps {
  data: TopToolDataPoint[];
}

export function TopToolsChart({ data }: TopToolsChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Tools</CardTitle>
          <CardDescription>Most frequently used tools</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No tool data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Tools</CardTitle>
        <CardDescription>Most frequently used tools</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="toolName" type="category" width={100} />
            <Tooltip
              formatter={(value: number, _name: string, props: any) => [
                `${value} uses (${props.payload.percentage.toFixed(1)}%)`,
                'Usage',
              ]}
            />
            <Bar dataKey="usageCount" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

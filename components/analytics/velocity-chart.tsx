'use client';

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { VelocityDataPoint } from '@/lib/analytics/types';

interface VelocityChartProps {
  data: VelocityDataPoint[];
}

export function VelocityChart({ data }: VelocityChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ticket Velocity</CardTitle>
          <CardDescription>Tickets shipped per week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No tickets shipped yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ticket Velocity</CardTitle>
        <CardDescription>Tickets shipped per week</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="weekLabel"
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value: number) => [`${value} tickets`, 'Shipped']}
            />
            <Bar dataKey="ticketsShipped" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

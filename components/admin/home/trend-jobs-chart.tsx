'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { JobsDailyPoint } from '@/app/lib/admin/home/types';
import { EmptyState } from './empty-state';

interface TrendJobsChartProps {
  data: JobsDailyPoint[];
}

export function TrendJobsChart({ data }: TrendJobsChartProps) {
  const allZero = data.every((p) => p.completed === 0 && p.failed === 0);
  if (allZero) {
    return (
      <EmptyState
        title="Jobs par jour (30j)"
        message="Aucun job exécuté dans la fenêtre."
      />
    );
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Jobs par jour (30j)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Legend />
              <Bar
                dataKey="completed"
                stackId="jobs"
                fill="hsl(var(--chart-3))"
                isAnimationActive={false}
                name="Complétés"
              />
              <Bar
                dataKey="failed"
                stackId="jobs"
                fill="hsl(var(--chart-4))"
                isAnimationActive={false}
                name="Échoués/annulés"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

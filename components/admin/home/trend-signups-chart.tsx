'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DailyPoint } from '@/app/lib/admin/home/types';
import { EmptyState } from './empty-state';

interface TrendSignupsChartProps {
  data: DailyPoint[];
}

export function TrendSignupsChart({ data }: TrendSignupsChartProps) {
  const allZero = data.every((p) => p.value === 0);
  if (allZero) {
    return (
      <EmptyState
        title="Inscriptions par jour (30j)"
        message="Aucune inscription dans la fenêtre."
      />
    );
  }
  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Inscriptions par jour (30j)</CardTitle>
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
              <Bar dataKey="value" fill="hsl(var(--chart-2))" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

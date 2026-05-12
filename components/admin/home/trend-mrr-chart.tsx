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
import type { MonthlyPoint } from '@/app/lib/admin/home/types';
import { formatPriceCents } from '@/app/lib/admin/home/formatters';
import { EmptyState } from './empty-state';

interface TrendMrrChartProps {
  data: MonthlyPoint[];
}

export function TrendMrrChart({ data }: TrendMrrChartProps) {
  const allZero = data.every((p) => p.mrrCents === 0);
  if (allZero) {
    return (
      <EmptyState title="MRR par mois (12 mois)" message="Pas de revenus à afficher." />
    );
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">MRR par mois (12 mois)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v: number) => formatPriceCents(v)}
              />
              <Tooltip
                formatter={(value) => formatPriceCents(Number(value))}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Bar dataKey="mrrCents" fill="hsl(var(--chart-5))" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

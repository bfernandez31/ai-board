'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { PlanDistribution } from '@/app/lib/admin/home/types';
import { EmptyState } from './empty-state';

interface PlanDistributionDonutProps {
  data: PlanDistribution;
}

export function PlanDistributionDonut({ data }: PlanDistributionDonutProps) {
  const total = data.free + data.pro + data.team;

  if (total === 0) {
    return (
      <EmptyState title="Répartition des plans" message="Aucun abonnement à afficher." />
    );
  }

  const chartData = [
    { name: 'FREE', value: data.free, color: 'hsl(var(--chart-3))' },
    { name: 'PRO', value: data.pro, color: 'hsl(var(--chart-1))' },
    { name: 'TEAM', value: data.team, color: 'hsl(var(--chart-2))' },
  ];

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Répartition des plans</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                isAnimationActive={false}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value}`, String(name)]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

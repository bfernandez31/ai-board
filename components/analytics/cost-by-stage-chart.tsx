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
import type { StageCost } from '@/lib/analytics/types';
import { formatCost } from '@/lib/analytics/aggregations';

interface CostByStageChartProps {
  data: StageCost[];
}

const STAGE_COLORS: Record<string, string> = {
  BUILD: 'hsl(var(--chart-1))',
  SPECIFY: 'hsl(var(--chart-2))',
  PLAN: 'hsl(var(--chart-3))',
  VERIFY: 'hsl(var(--chart-4))',
};

export function CostByStageChart({ data }: CostByStageChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost by Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No stage data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cost by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis
                type="number"
                tickFormatter={(value) => formatCost(value)}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="stage"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={60}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as StageCost;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.stage}</p>
                      <p className="text-sm text-muted-foreground">
                        Cost: {formatCost(item.cost)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.percentage.toFixed(1)}% of total
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? 'hsl(var(--chart-1))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

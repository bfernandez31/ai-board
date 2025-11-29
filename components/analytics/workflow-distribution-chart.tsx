'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { WorkflowBreakdown } from '@/lib/analytics/types';

interface WorkflowDistributionChartProps {
  data: WorkflowBreakdown[];
}

const WORKFLOW_COLORS: Record<string, string> = {
  FULL: 'hsl(var(--chart-1))',
  QUICK: 'hsl(var(--chart-3))',
  CLEAN: 'hsl(var(--chart-5))',
};

export function WorkflowDistributionChart({ data }: WorkflowDistributionChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workflow Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No workflow data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Transform data for Recharts compatibility
  const chartData = data.map((d) => ({
    name: d.type,
    value: d.count,
    percentage: d.percentage,
    color: WORKFLOW_COLORS[d.type] ?? 'hsl(var(--chart-1))',
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workflow Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                nameKey="name"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.value} tickets ({item.percentage.toFixed(1)}%)
                      </p>
                    </div>
                  );
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

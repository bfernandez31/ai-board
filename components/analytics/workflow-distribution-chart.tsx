'use client';

import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { WorkflowDistributionDataPoint } from '@/lib/analytics/types';

interface WorkflowDistributionChartProps {
  data: WorkflowDistributionDataPoint[];
}

const WORKFLOW_COLORS: Record<string, string> = {
  FULL: 'hsl(var(--chart-1))',
  QUICK: 'hsl(var(--chart-2))',
  CLEAN: 'hsl(var(--chart-3))',
};

export function WorkflowDistributionChart({ data }: WorkflowDistributionChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Distribution</CardTitle>
          <CardDescription>Ticket workflow type breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Distribution</CardTitle>
        <CardDescription>Ticket workflow type breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              fill="#8884d8"
              dataKey="ticketCount"
              label={(entry) => `${entry.workflowType}: ${entry.percentage.toFixed(1)}%`}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={WORKFLOW_COLORS[entry.workflowType] || 'hsl(var(--chart-4))'}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, _name: string, props: any) => [
                `${value} tickets (${props.payload.percentage.toFixed(1)}%)`,
                props.payload.workflowType,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

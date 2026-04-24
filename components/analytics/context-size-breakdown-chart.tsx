'use client';

import { useState } from 'react';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ContextGroupingDatum, ContextSizeAnalytics } from '@/lib/analytics/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatAbbreviatedNumber } from '@/lib/analytics/aggregations';

type GroupingMode = 'command' | 'workflow' | 'quality';

const GROUPING_LABELS: Record<GroupingMode, string> = {
  command: 'Command',
  workflow: 'Workflow',
  quality: 'Quality Bucket',
};

function getGroupingData(
  analytics: ContextSizeAnalytics,
  grouping: GroupingMode
): ContextGroupingDatum[] {
  switch (grouping) {
    case 'command':
      return analytics.byCommand;
    case 'workflow':
      return analytics.byWorkflowType;
    case 'quality':
      return analytics.byQualityBucket;
  }
}

function parseGroupingMode(value: string): GroupingMode {
  if (value === 'workflow') {
    return 'workflow';
  }
  if (value === 'quality') {
    return 'quality';
  }

  return 'command';
}

interface ContextSizeBreakdownChartProps {
  data: ContextSizeAnalytics;
  emptyMessage?: string;
}

export function ContextSizeBreakdownChart({
  data,
  emptyMessage = 'No context-size groupings available',
}: ContextSizeBreakdownChartProps) {
  const [grouping, setGrouping] = useState<GroupingMode>('command');
  const chartData = getGroupingData(data, grouping);

  if (chartData.length === 0) {
    return (
      <Card className="aurora-bg-subtle">
        <CardHeader>
          <CardTitle className="text-base text-foreground">Context Size Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            {emptyMessage}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base text-foreground">Context Size Breakdown</CardTitle>
        <Select value={grouping} onValueChange={(value) => setGrouping(parseGroupingMode(value))}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="context-grouping-filter">
            <SelectValue placeholder="Grouping" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="command">Command</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="quality">Quality Bucket</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Average peak context grouped by {GROUPING_LABELS[grouping].toLowerCase()}.
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 10, right: 10 }}>
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                tickFormatter={(value) => formatAbbreviatedNumber(value)}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                width={50}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0]?.payload as ContextGroupingDatum;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">
                        Avg peak {formatAbbreviatedNumber(item.averagePeakContext)} tokens
                      </p>
                      <p className="text-sm text-muted-foreground">{item.count} jobs</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="averagePeakContext" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

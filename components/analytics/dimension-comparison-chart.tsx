'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { sortDimensionComparisons } from '@/lib/analytics/dimension-comparison';
import type { DimensionComparison } from '@/lib/analytics/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DimensionComparisonChartProps {
  data: DimensionComparison[];
  emptyMessage?: string;
}

export function DimensionComparisonChart({
  data,
  emptyMessage = 'No dimension data available',
}: DimensionComparisonChartProps): React.JSX.Element {
  const sortedData = sortDimensionComparisons(data);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-foreground">Quality Dimensions</CardTitle>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-foreground">Quality Dimensions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ left: 20, right: 10 }}
            >
              <XAxis
                type="number"
                domain={[0, 100]}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="dimension"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                width={100}
                tickFormatter={(value) => {
                  // Abbreviate long names
                  if (value.length > 12) return value.substring(0, 11) + '...';
                  return value;
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number, _name: string, props: { payload?: DimensionComparison }) => [
                  `${value}/100 (weight: ${Math.round((props.payload?.weight ?? 0) * 100)}%)`,
                  'Avg Score',
                ]}
              />
              <Bar
                dataKey="averageScore"
                fill="hsl(var(--chart-3))"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { VerdictDistribution } from '@/lib/calibration/types';

interface VerdictDistributionChartProps {
  title: string;
  distribution: VerdictDistribution;
  naTooltip: string;
}

interface BarDatum {
  bucket: string;
  count: number;
}

function formatRate(rate: number | null): string {
  if (rate === null) return 'n/a';
  return `${(rate * 100).toFixed(1)}%`;
}

export function VerdictDistributionChart({
  title,
  distribution,
  naTooltip,
}: VerdictDistributionChartProps) {
  const data: BarDatum[] = [
    { bucket: 'Hit', count: distribution.hit },
    { bucket: 'Miss', count: distribution.miss },
    { bucket: 'N/A', count: distribution.na },
  ];

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
        <p className="text-xs text-muted-foreground" title={naTooltip}>
          {`Hit-rate: ${formatRate(distribution.hitRate)} (excludes N/A)`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                dataKey="bucket"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table
          role="table"
          className="mt-4 w-full text-sm"
          aria-label={`${title} tabular fallback`}
        >
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-2">
                Bucket
              </th>
              <th scope="col" className="pb-2">
                Count
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className="py-1 font-normal">
                Hit
              </th>
              <td className="py-1">{distribution.hit}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1 font-normal">
                Miss
              </th>
              <td className="py-1">{distribution.miss}</td>
            </tr>
            <tr>
              <th scope="row" className="py-1 font-normal" title={naTooltip}>
                N/A
              </th>
              <td className="py-1">{distribution.na}</td>
            </tr>
            <tr className="border-t border-border">
              <th scope="row" className="pt-2 font-medium">
                Total
              </th>
              <td className="pt-2 font-medium">{distribution.total}</td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import type { ComparisonEntryData } from './types';

interface ComparisonMetricsProps {
  entries: ComparisonEntryData[];
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

type MetricKey = 'linesAdded' | 'linesRemoved' | 'sourceFileCount' | 'testFileCount' | 'testRatio';

const METRIC_LABELS: Record<MetricKey, string> = {
  linesAdded: 'Lines Added',
  linesRemoved: 'Lines Removed',
  sourceFileCount: 'Source Files',
  testFileCount: 'Test Files',
  testRatio: 'Test Ratio',
};

const METRIC_KEYS: MetricKey[] = [
  'linesAdded',
  'linesRemoved',
  'sourceFileCount',
  'testFileCount',
  'testRatio',
];

export function ComparisonMetrics({ entries }: ComparisonMetricsProps) {
  const { chartData, ticketKeys, bestValues } = useMemo(() => {
    const keys = entries.map(
      (e) => e.ticket?.ticketKey ?? `Entry #${e.rank}`
    );

    // Compute best value per metric (highest is best)
    const best: Record<MetricKey, number> = {
      linesAdded: -Infinity,
      linesRemoved: -Infinity,
      sourceFileCount: -Infinity,
      testFileCount: -Infinity,
      testRatio: -Infinity,
    };

    for (const entry of entries) {
      for (const key of METRIC_KEYS) {
        const val = entry.metrics[key];
        if (val > best[key]) {
          best[key] = val;
        }
      }
    }

    const data = METRIC_KEYS.map((metricKey) => {
      const row: Record<string, string | number> = {
        metric: METRIC_LABELS[metricKey],
      };
      entries.forEach((entry, idx) => {
        const k = keys[idx];
        if (k !== undefined) {
          row[k] = entry.metrics[metricKey];
        }
      });
      return row;
    });

    return { chartData: data, ticketKeys: keys, bestValues: best };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No metrics data available.</p>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={METRIC_KEYS.length * 80 + 60}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
        >
          <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
          <YAxis
            type="category"
            dataKey="metric"
            width={90}
            stroke="hsl(var(--muted-foreground))"
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--card-foreground))',
            }}
          />
          <Legend />
          {ticketKeys.map((key, idx) => (
            <Bar
              key={key}
              dataKey={key}
              fill={CHART_COLORS[idx % CHART_COLORS.length]}
              barSize={16}
            >
              {chartData.map((row, rowIdx) => {
                const metricKey = METRIC_KEYS[rowIdx] as MetricKey | undefined;
                const val = row[key] as number;
                const isBest = metricKey != null && val === bestValues[metricKey] && val > 0;
                return (
                  <Cell
                    key={`cell-${rowIdx}`}
                    fillOpacity={isBest ? 1 : 0.5}
                  />
                );
              })}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

'use client';

import { ResponsiveContainer, LineChart, Line } from 'recharts';
import type { TrendPoint } from '@/lib/admin/home/types';

interface DeltaItem {
  label: string;
  value: string;
}

interface PulseTileProps {
  title: string;
  value: number | string;
  deltas: DeltaItem[];
  spark: TrendPoint[];
  formatter?: (v: number) => string;
  sparkStroke?: string;
}

export function PulseTile({ title, value, deltas, spark, formatter, sparkStroke = 'hsl(var(--chart-1))' }: PulseTileProps) {
  const displayValue = typeof value === 'number' && formatter ? formatter(value) : String(value);

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <span className="text-sm text-muted-foreground">{title}</span>
      <span className="text-2xl font-semibold tabular-nums">{displayValue}</span>
      {deltas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {deltas.map((d) => (
            <span key={d.label} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{d.value}</span>
              {' '}
              {d.label}
            </span>
          ))}
        </div>
      )}
      {spark.length === 0 ? (
        <div className="h-10 text-muted-foreground flex items-center justify-center text-xs">
          No data yet
        </div>
      ) : (
        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark}>
              <Line
                type="monotone"
                dataKey="v"
                stroke={sparkStroke}
                dot={false}
                strokeWidth={1.5}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

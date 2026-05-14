'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { PlanDistributionRow } from '@/lib/admin/home/types';
import { renderChartTooltip } from './chart-tooltip';

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
];

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  TEAM: 'Team',
};

interface PlanDonutProps {
  data: PlanDistributionRow[];
}

export function PlanDonut({ data }: PlanDonutProps) {
  const total = data.reduce((sum, row) => sum + row.count, 0);
  // When total is 0 we still render the legend with every plan at 0 so the
  // operator can confirm each segment exists. The donut chart itself collapses
  // to an empty hint since recharts can't draw a slice with no value.
  return (
    <div className="flex flex-col gap-3">
      <div className="h-32 flex items-center justify-center">
        {total === 0 ? (
          <span className="text-xs text-muted-foreground">No plan data yet</span>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={56} innerRadius={30}>
                {data.map((entry, i) => (
                  <Cell key={entry.plan} fill={COLORS[i % COLORS.length] ?? 'hsl(var(--chart-1))'} />
                ))}
              </Pie>
              <Tooltip
                content={renderChartTooltip<PlanDistributionRow>((entry) => {
                  const idx = data.findIndex((row) => row.plan === entry.plan);
                  const color = COLORS[idx % COLORS.length] ?? 'hsl(var(--chart-1))';
                  const share = total > 0 ? Math.round((entry.count / total) * 100) : 0;
                  return {
                    title: PLAN_LABELS[entry.plan] ?? entry.plan,
                    rows: [
                      { label: 'Users', value: entry.count, color },
                      { label: 'Share', value: `${share}%` },
                    ],
                  };
                })}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-col gap-1">
        {data.map((entry, i) => (
          <div key={entry.plan} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              {PLAN_LABELS[entry.plan] ?? entry.plan}
            </span>
            <span className="tabular-nums font-medium">{entry.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

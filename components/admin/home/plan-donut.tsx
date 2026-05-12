'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { PlanDistributionRow } from '@/lib/admin/home/types';

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
  return (
    <div className="flex flex-col gap-3">
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={56} innerRadius={30}>
              {data.map((entry, i) => (
                <Cell key={entry.plan} fill={COLORS[i % COLORS.length] ?? 'hsl(var(--chart-1))'} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
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

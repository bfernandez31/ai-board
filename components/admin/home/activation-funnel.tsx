'use client';

import type { ActivationFunnel } from '@/lib/admin/home/types';

const STEP_LABELS: Record<string, string> = {
  SIGNUP: 'Signup',
  FIRST_PROJECT: 'First project',
  FIRST_JOB: 'First job',
  FIRST_PAID: 'First paid',
};

interface ActivationFunnelProps {
  data: ActivationFunnel;
}

export function ActivationFunnelChart({ data }: ActivationFunnelProps) {
  if (data.cohortSize === 0) {
    return (
      <div className="text-muted-foreground text-xs py-4 text-center">
        No signups in the last 30 days
      </div>
    );
  }

  const maxCount = data.cohortSize;

  return (
    <ol className="flex flex-col gap-2">
      {data.steps.map((step) => {
        const width = maxCount > 0 ? Math.round((step.count / maxCount) * 100) : 0;
        const rateDisplay = step.stepRate === null ? '—' : `${(step.stepRate * 100).toFixed(1)}%`;
        return (
          <li key={step.key} className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{STEP_LABELS[step.key] ?? step.key}</span>
              <span className="tabular-nums">
                {step.count} <span className="text-foreground/50">{rateDisplay}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-chart-1"
                style={{ width: `${width}%`, background: 'hsl(var(--chart-1))' }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

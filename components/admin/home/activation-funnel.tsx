'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FunnelStep } from '@/app/lib/admin/home/types';
import { formatCountWithSpacedThousands, formatPercent } from '@/app/lib/admin/home/formatters';

interface ActivationFunnelProps {
  steps: FunnelStep[];
}

export function ActivationFunnel({ steps }: ActivationFunnelProps) {
  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Funnel d&apos;activation (30j)</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li
              key={step.id}
              className="rounded-md border bg-card p-3"
              data-funnel-step={step.id}
            >
              <p className="text-xs text-muted-foreground">{step.label}</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCountWithSpacedThousands(step.count)}
              </p>
              <p className="text-xs text-muted-foreground">
                {step.conversionFromPrevious === null
                  ? '—'
                  : formatPercent(step.conversionFromPrevious)}
                {step.conversionFromPrevious !== null && (
                  <span className="ml-1">vs. étape précédente</span>
                )}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

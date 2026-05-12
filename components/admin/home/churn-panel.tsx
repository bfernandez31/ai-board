'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChurnPanel as ChurnPanelData } from '@/app/lib/admin/home/types';
import {
  formatCountWithSpacedThousands,
  formatDelta,
  formatPriceCents,
} from '@/app/lib/admin/home/formatters';
import { cn } from '@/lib/utils';

interface ChurnPanelProps {
  data: ChurnPanelData;
}

export function ChurnPanel({ data }: ChurnPanelProps) {
  const netClass = cn(
    'text-lg font-semibold',
    data.netMrrDeltaCents > 0 && 'text-foreground',
    data.netMrrDeltaCents < 0 && 'text-destructive',
    data.netMrrDeltaCents === 0 && 'text-muted-foreground'
  );

  return (
    <Card className="aurora-bg-subtle">
      <CardHeader>
        <CardTitle className="text-base text-foreground">Churn (mois en cours)</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Cancellations</dt>
            <dd className="text-lg font-semibold text-foreground">
              {formatCountWithSpacedThousands(data.cancellationsCount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Downgrades</dt>
            <dd className="text-lg font-semibold text-foreground">
              {formatCountWithSpacedThousands(data.downgradesCount)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">MRR perdu</dt>
            <dd className="text-lg font-semibold text-destructive">
              {formatPriceCents(data.mrrLostCents)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Net MRR</dt>
            <dd className={netClass}>
              {formatDelta({
                label: 'Net',
                value: data.netMrrDeltaCents,
                unit: 'absolute',
                goodDirection: 'up',
              })}{' '}
              <span className="text-xs text-muted-foreground">cents</span>
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

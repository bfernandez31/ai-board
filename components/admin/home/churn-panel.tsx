'use client';

import { formatUsdCents } from '@/lib/admin/home/format';
import type { Churn } from '@/lib/admin/home/types';

interface ChurnPanelProps {
  data: Churn;
}

export function ChurnPanel({ data }: ChurnPanelProps) {
  const netFormatted = `${data.netMrrDeltaUsd < 0 ? '-' : ''}${formatUsdCents(Math.abs(data.netMrrDeltaUsd))}`;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-0.5 rounded-md border bg-muted/30 p-3">
        <span className="text-xs text-muted-foreground">Cancellations</span>
        <span className="text-xl font-semibold tabular-nums">{data.cancellations}</span>
      </div>
      <div className="flex flex-col gap-0.5 rounded-md border bg-muted/30 p-3">
        <span className="text-xs text-muted-foreground">Downgrades</span>
        <span className="text-xl font-semibold tabular-nums">{data.downgrades}</span>
      </div>
      <div className="flex flex-col gap-0.5 rounded-md border bg-muted/30 p-3">
        <span className="text-xs text-muted-foreground">MRR Lost</span>
        <span className="text-xl font-semibold tabular-nums text-destructive">
          {formatUsdCents(data.mrrLostUsd)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 rounded-md border bg-muted/30 p-3">
        <span className="text-xs text-muted-foreground">Net MRR Delta</span>
        <span className={`text-xl font-semibold tabular-nums ${data.netMrrDeltaUsd >= 0 ? 'text-green-600' : 'text-destructive'}`}>
          {data.netMrrDeltaUsd >= 0 ? `+${formatUsdCents(data.netMrrDeltaUsd)}` : netFormatted}
        </span>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import type { Alert } from '@/lib/admin/home/types';

const KIND_LABELS: Record<Alert['kind'], string> = {
  LOW_SUCCESS_RATE: 'Low success rate',
  STRIPE_WEBHOOK_ERRORS: 'Stripe webhook errors',
  STALE_CRITICAL_CRON: 'Stale cron',
};

interface AlertStackProps {
  alerts: Alert[];
}

export function AlertStack({ alerts }: AlertStackProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          role="alert"
          className="aurora-card flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-destructive">{KIND_LABELS[alert.kind]}</span>
            <span className="text-muted-foreground">{alert.message}</span>
          </div>
          <Link
            href={alert.href}
            className="shrink-0 text-xs font-medium text-destructive underline-offset-4 hover:underline"
          >
            View details
          </Link>
        </div>
      ))}
    </div>
  );
}

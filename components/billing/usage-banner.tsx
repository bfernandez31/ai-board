'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { useUsage } from '@/hooks/use-usage';

export function UsageBanner() {
  const { data: usage } = useUsage();

  if (!usage) {
    return null;
  }

  const isPastDue = usage.status === 'past_due' && usage.gracePeriodEndsAt;

  return (
    <div className="space-y-2">
      {isPastDue && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600 dark:text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Payment failed. Your plan limits will be reduced to Free on{' '}
            {new Date(usage.gracePeriodEndsAt!).toLocaleDateString()}.{' '}
            <Link href="/settings/billing" className="underline font-medium">
              Update payment method
            </Link>
          </p>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        {usage.projects.max !== null || usage.ticketsThisMonth.max !== null ? (
          <span>
            {usage.projects.max !== null && (
              <>{usage.projects.current}/{usage.projects.max} projects</>
            )}
            {usage.projects.max !== null && usage.ticketsThisMonth.max !== null && ' | '}
            {usage.ticketsThisMonth.max !== null && (
              <>{usage.ticketsThisMonth.current}/{usage.ticketsThisMonth.max} tickets this month</>
            )}
            {' | '}{usage.planName} Plan
          </span>
        ) : (
          <span>{usage.planName} Plan</span>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsage, type UsageData } from '@/hooks/use-usage';
import type { SubscriptionPlan } from '@prisma/client';

const BANNER_HEIGHT = 'h-14';

const planConfig: Record<SubscriptionPlan, {
  gradient: string;
  badgeBg: string;
  badgeText: string;
}> = {
  TEAM: {
    gradient: 'aurora-plan-team',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
  },
  PRO: {
    gradient: 'aurora-plan-pro',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
  },
  FREE: {
    gradient: 'aurora-plan-free',
    badgeBg: 'bg-zinc-500/20',
    badgeText: 'text-zinc-400',
  },
};

function formatUsageCounters(usage: UsageData): string {
  const parts: string[] = [];

  if (usage.projects.max !== null) {
    parts.push(`${usage.projects.current}/${usage.projects.max} project${usage.projects.max === 1 ? '' : 's'}`);
  } else {
    parts.push(`${usage.projects.current} project${usage.projects.current === 1 ? '' : 's'}`);
  }

  if (usage.ticketsThisMonth.max !== null) {
    parts.push(`${usage.ticketsThisMonth.current}/${usage.ticketsThisMonth.max} tickets this month`);
  } else {
    parts.push(`${usage.ticketsThisMonth.current} ticket${usage.ticketsThisMonth.current === 1 ? '' : 's'} this month`);
  }

  return parts.join(' \u00b7 ');
}

function PlanBannerSkeleton() {
  return (
    <Skeleton className={`${BANNER_HEIGHT} w-full rounded-lg`} />
  );
}

function PastDueWarning({ gracePeriodEndsAt }: { gracePeriodEndsAt: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
      <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600 dark:text-yellow-400 shrink-0" />
      <p className="text-sm text-yellow-700 dark:text-yellow-300">
        Payment failed. Your plan limits will be reduced to Free on{' '}
        {new Date(gracePeriodEndsAt).toLocaleDateString()}.{' '}
        <Link href="/settings/billing" className="underline font-medium">
          Update payment method
        </Link>
      </p>
    </div>
  );
}

export function PlanBannerCard() {
  const { data: usage } = useUsage();

  if (!usage) {
    return (
      <div className="space-y-2">
        <PlanBannerSkeleton />
      </div>
    );
  }

  const config = planConfig[usage.plan];
  const isFree = usage.plan === 'FREE';

  return (
    <div className="space-y-2">
      {usage.status === 'past_due' && usage.gracePeriodEndsAt && (
        <PastDueWarning gracePeriodEndsAt={usage.gracePeriodEndsAt} />
      )}

      <div
        className={`${config.gradient} ${BANNER_HEIGHT} flex items-center justify-between rounded-lg border border-border/50 px-4`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`${config.badgeBg} ${config.badgeText} shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide`}
          >
            {usage.plan}
          </span>
          <span className="text-sm text-muted-foreground truncate">
            {formatUsageCounters(usage)}
          </span>
        </div>

        <Link
          href="/settings/billing"
          className="shrink-0 flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {isFree ? 'Upgrade' : 'Manage plan'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

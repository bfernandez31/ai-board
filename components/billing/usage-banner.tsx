'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsage, type UsageData } from '@/hooks/use-usage';

interface BannerStyles {
  cardClassName: string;
  badgeClassName: string;
}

function getBannerStyles(plan: UsageData['plan']): BannerStyles {
  switch (plan) {
    case 'TEAM':
      return {
        cardClassName:
          'border-indigo-500/20 bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-background',
        badgeClassName: 'border-violet-500/30 bg-violet-500/15 text-violet-950 dark:text-violet-100',
      };
    case 'PRO':
      return {
        cardClassName:
          'border-sky-500/20 bg-gradient-to-r from-sky-500/15 via-cyan-500/10 to-background',
        badgeClassName: 'border-sky-500/30 bg-sky-500/15 text-sky-950 dark:text-sky-100',
      };
    case 'FREE':
    default:
      return {
        cardClassName:
          'border-border bg-gradient-to-r from-muted/90 via-muted/60 to-background',
        badgeClassName: 'border-border bg-background/80 text-muted-foreground',
      };
  }
}

function formatUsageSummary(usage: UsageData): string {
  const projectLabel = usage.projects.current === 1 ? 'project' : 'projects';

  if (usage.plan === 'FREE' && usage.projects.max !== null && usage.ticketsThisMonth.max !== null) {
    return `${usage.projects.current}/${usage.projects.max} ${projectLabel} · ${usage.ticketsThisMonth.current}/${usage.ticketsThisMonth.max} tickets this month`;
  }

  return `${usage.projects.current} ${projectLabel} · ${usage.ticketsThisMonth.current} tickets this month`;
}

function UsageBannerSkeleton() {
  return (
    <div
      data-testid="usage-banner-skeleton"
      className="min-h-24 animate-pulse rounded-xl border border-border bg-gradient-to-r from-muted/90 via-muted/60 to-background p-4"
    >
      <div className="flex min-h-16 flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-5 w-48 rounded-full sm:w-64" />
        </div>
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
    </div>
  );
}

export function UsageBanner() {
  const { data: usage } = useUsage();

  if (!usage) {
    return <UsageBannerSkeleton />;
  }

  const gracePeriodEndsAt = usage.gracePeriodEndsAt;
  const isPastDue = usage.status === 'past_due' && gracePeriodEndsAt !== null;
  const { cardClassName, badgeClassName } = getBannerStyles(usage.plan);
  const ctaLabel = usage.plan === 'FREE' ? 'Upgrade' : 'Manage plan';

  return (
    <div className="space-y-3">
      {isPastDue && (
        <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Payment failed. Your plan limits will be reduced to Free on{' '}
            {new Date(gracePeriodEndsAt).toLocaleDateString()}.{' '}
            <Link href="/settings/billing" className="font-medium underline">
              Update payment method
            </Link>
          </p>
        </div>
      )}

      <div
        data-testid="usage-banner-card"
        className={`min-h-24 rounded-xl border p-4 shadow-sm ${cardClassName}`}
      >
        <div className="flex min-h-16 flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              data-testid="usage-banner-badge"
              className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.24em] ${badgeClassName}`}
            >
              {usage.plan}
            </Badge>
            <p className="text-sm font-medium text-foreground">
              {formatUsageSummary(usage)}
            </p>
          </div>

          <Link
            href="/settings/billing"
            className="inline-flex items-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

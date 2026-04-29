'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUsage, type UsageData } from '@/hooks/use-usage';
import { cn } from '@/lib/utils';

interface BannerStyles {
  cardClassName: string;
  badgeVariant: 'default' | 'secondary';
}

function getBannerStyles(plan: UsageData['plan']): BannerStyles {
  switch (plan) {
    case 'TEAM':
      return {
        cardClassName:
          'border-indigo-500/20 bg-gradient-to-r from-indigo-500/15 via-violet-500/10 to-background',
        badgeVariant: 'default',
      };
    case 'PRO':
      return {
        cardClassName:
          'border-sky-500/20 bg-gradient-to-r from-sky-500/15 via-cyan-500/10 to-background',
        badgeVariant: 'default',
      };
    case 'FREE':
    default:
      return {
        cardClassName:
          'border-border bg-gradient-to-r from-muted/90 via-muted/60 to-background',
        badgeVariant: 'secondary',
      };
  }
}

function formatUsageSummary(usage: UsageData): string {
  const projectLabel = usage.projects.current === 1 ? 'project' : 'projects';
  const projectUsage =
    usage.plan === 'FREE' && usage.projects.max !== null
      ? `${usage.projects.current}/${usage.projects.max} ${projectLabel}`
      : `${usage.projects.current} ${projectLabel}`;
  const ticketUsage =
    usage.plan === 'FREE' && usage.ticketsThisMonth.max !== null
      ? `${usage.ticketsThisMonth.current}/${usage.ticketsThisMonth.max} tickets this month`
      : `${usage.ticketsThisMonth.current} tickets this month`;

  return `${projectUsage} · ${ticketUsage}`;
}

function UsageBannerSkeleton(): JSX.Element {
  return (
    <div
      data-testid="usage-banner-skeleton"
      className="animate-pulse rounded-xl border border-border bg-gradient-to-r from-muted/90 via-muted/60 to-background px-4 py-2.5"
    >
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-5 w-48 rounded-full sm:w-64" />
        </div>
        <Skeleton className="h-5 w-28 rounded-full" />
      </div>
    </div>
  );
}

export function UsageBanner(): JSX.Element {
  const { data: usage } = useUsage();

  if (!usage) {
    return <UsageBannerSkeleton />;
  }

  const gracePeriodEndsAt = usage.gracePeriodEndsAt;
  const isPastDue = usage.status === 'past_due' && gracePeriodEndsAt !== null;
  const { cardClassName, badgeVariant } = getBannerStyles(usage.plan);
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
        className={cn('rounded-xl border px-4 py-2.5 shadow-sm', cardClassName)}
      >
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant={badgeVariant}
              data-testid="usage-banner-badge"
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

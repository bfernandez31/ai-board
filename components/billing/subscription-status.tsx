'use client';

import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { SubscriptionData } from '@/hooks/use-subscription';
import { useUsage, type UsageData } from '@/hooks/use-usage';

interface SubscriptionStatusProps {
  subscription: SubscriptionData;
}

function formatUsage(current: number, limit: number | null): string {
  if (limit === null) return 'Unlimited';
  return `${current}/${limit}`;
}

function getStatusVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'active':
      return 'default';
    case 'trialing':
      return 'secondary';
    case 'past_due':
      return 'destructive';
    case 'canceled':
      return 'outline';
    default:
      return 'outline';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trial';
    case 'past_due':
      return 'Past Due';
    case 'canceled':
      return 'Canceled';
    case 'none':
      return 'No Subscription';
    default:
      return status;
  }
}

export function SubscriptionStatus({ subscription }: SubscriptionStatusProps) {
  const isTrialing = subscription.status === 'trialing';
  const trialEndDate = subscription.trialEnd
    ? new Date(subscription.trialEnd)
    : null;
  const periodEndDate = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd)
    : null;
  const { data: usage } = useUsage();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Current Plan
          <Badge variant={getStatusVariant(subscription.status)}>
            {getStatusLabel(subscription.status)}
          </Badge>
        </CardTitle>
        <CardDescription>
          {subscription.plan === 'FREE'
            ? 'You are on the Free plan'
            : `You are on the ${subscription.plan} plan`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isTrialing && trialEndDate && (
          <p className="text-muted-foreground">
            Trial ends on{' '}
            <span className="font-medium text-foreground">
              {trialEndDate.toLocaleDateString()}
            </span>
            . Billing begins after trial.
          </p>
        )}
        {periodEndDate && !isTrialing && subscription.status !== 'none' && (
          <p className="text-muted-foreground">
            Current period ends{' '}
            <span className="font-medium text-foreground">
              {periodEndDate.toLocaleDateString()}
            </span>
          </p>
        )}
        {subscription.cancelAt && (
          <p className="text-destructive">
            Cancels on{' '}
            {new Date(subscription.cancelAt).toLocaleDateString()}
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <UsageItem
            label="Projects"
            usage={usage}
            getValue={(u) => formatUsage(u.projects.current, u.projects.limit)}
            fallback={subscription.limits.maxProjects ?? 'Unlimited'}
            isAtLimit={usage ? isAtLimit(usage.projects) : false}
          />
          <UsageItem
            label="Tickets/month"
            usage={usage}
            getValue={(u) => formatUsage(u.ticketsThisMonth.current, u.ticketsThisMonth.limit)}
            fallback={subscription.limits.maxTicketsPerMonth ?? 'Unlimited'}
            isAtLimit={usage ? isAtLimit(usage.ticketsThisMonth) : false}
          />
          <div>
            <p className="text-xs text-muted-foreground">Members</p>
            <p className="font-medium">
              {subscription.limits.membersEnabled
                ? `Up to ${subscription.limits.maxMembersPerProject ?? 'Unlimited'}/project`
                : 'Not available'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Analytics</p>
            <p className="font-medium">
              {subscription.limits.advancedAnalytics ? 'Advanced' : 'Basic'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function isAtLimit(resource: { current: number; limit: number | null }): boolean {
  return resource.limit !== null && resource.current >= resource.limit;
}

function UsageItem({
  label,
  usage,
  getValue,
  fallback,
  isAtLimit: atLimit,
}: {
  label: string;
  usage: UsageData | undefined;
  getValue: (u: UsageData) => string;
  fallback: string | number;
  isAtLimit: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium ${atLimit ? 'text-destructive' : ''}`}>
        {usage ? getValue(usage) : fallback}
      </p>
    </div>
  );
}

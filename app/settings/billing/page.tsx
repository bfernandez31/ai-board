'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PricingCards } from '@/components/billing/pricing-cards';
import { SubscriptionStatus } from '@/components/billing/subscription-status';
import { useSubscription } from '@/hooks/use-subscription';
import { useQuery } from '@tanstack/react-query';
import type { SubscriptionPlan } from '@prisma/client';

interface PlanInfo {
  plan: SubscriptionPlan;
  name: string;
  priceMonthly: number;
  features: string[];
}

function BillingContent() {
  const searchParams = useSearchParams();
  const { data: subscription, isLoading } = useSubscription();
  const { data: plans = [] } = useQuery<PlanInfo[]>({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const res = await fetch('/api/billing/plans');
      const data = await res.json();
      return data.plans;
    },
  });
  const [managingPortal, setManagingPortal] = useState(false);

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    }
  };

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setManagingPortal(false);
    }
  };

  return (
    <main className="container mx-auto py-10 max-w-4xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Billing & Subscription
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage your plan and billing settings
              </p>
            </div>
          </div>
          {subscription &&
            subscription.status !== 'none' &&
            subscription.plan !== 'FREE' && (
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={managingPortal}
              >
                {managingPortal ? 'Loading...' : 'Manage Subscription'}
              </Button>
            )}
        </div>

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            Subscription activated successfully!
          </div>
        )}

        {canceled && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            Checkout was canceled. You can try again when ready.
          </div>
        )}

        {isLoading ? (
          <div className="text-muted-foreground">Loading subscription...</div>
        ) : subscription ? (
          <SubscriptionStatus subscription={subscription} />
        ) : null}

        {plans.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Available Plans</h2>
            <PricingCards
              plans={plans}
              currentPlan={subscription?.plan ?? 'FREE'}
              onSubscribe={handleSubscribe}
            />
          </div>
        )}
      </div>
    </main>
  );
}

export default function BillingSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto py-10 max-w-4xl text-muted-foreground">
          Loading billing...
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}

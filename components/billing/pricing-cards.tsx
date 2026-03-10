'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { SubscriptionPlan } from '@prisma/client';

interface PlanInfo {
  plan: SubscriptionPlan;
  name: string;
  priceMonthly: number;
  features: string[];
}

interface PricingCardsProps {
  plans: PlanInfo[];
  currentPlan: SubscriptionPlan;
  onSubscribe: (plan: SubscriptionPlan) => Promise<void>;
}

function PlanButton({
  plan,
  isCurrent,
  isPopular,
  loading,
  onSubscribe,
}: {
  plan: SubscriptionPlan;
  isCurrent: boolean;
  isPopular: boolean;
  loading: SubscriptionPlan | null;
  onSubscribe: (plan: SubscriptionPlan) => void;
}) {
  if (isCurrent) {
    return (
      <Button variant="outline" className="w-full" disabled>
        Current Plan
      </Button>
    );
  }

  if (plan === 'FREE') {
    return (
      <Button variant="outline" className="w-full" disabled>
        Free
      </Button>
    );
  }

  return (
    <Button
      className="w-full"
      variant={isPopular ? 'default' : 'outline'}
      disabled={loading !== null}
      onClick={() => onSubscribe(plan)}
    >
      {loading === plan ? 'Loading...' : 'Subscribe'}
    </Button>
  );
}

export function PricingCards({
  plans,
  currentPlan,
  onSubscribe,
}: PricingCardsProps) {
  const [loading, setLoading] = useState<SubscriptionPlan | null>(null);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    setLoading(plan);
    try {
      await onSubscribe(plan);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => {
        const isCurrent = plan.plan === currentPlan;
        const isPopular = plan.plan === 'PRO';

        return (
          <Card
            key={plan.plan}
            className={isPopular ? 'border-primary shadow-md' : ''}
          >
            <CardHeader>
              {isPopular && (
                <p className="text-xs font-medium uppercase text-primary">
                  Most Popular
                </p>
              )}
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>
                {plan.priceMonthly === 0 ? (
                  <span className="text-2xl font-bold">Free</span>
                ) : (
                  <>
                    <span className="text-2xl font-bold">
                      ${(plan.priceMonthly / 100).toFixed(0)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <PlanButton
                plan={plan.plan}
                isCurrent={isCurrent}
                isPopular={isPopular}
                loading={loading}
                onSubscribe={handleSubscribe}
              />
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

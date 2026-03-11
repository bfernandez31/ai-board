'use client';

import type { JSX } from 'react';
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
import { cn } from '@/lib/utils';

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
  highlightPlan?: SubscriptionPlan | null;
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
  onSubscribe: (plan: SubscriptionPlan) => Promise<void>;
}): JSX.Element {
  if (isCurrent || plan === 'FREE') {
    const label = isCurrent ? 'Current Plan' : 'Free';
    return (
      <Button variant="outline" className="w-full" disabled>
        {label}
      </Button>
    );
  }

  const isDisabled = loading !== null;
  const label = loading === plan ? 'Loading...' : 'Subscribe';
  const variant = isPopular ? 'default' : 'outline';
  const handleClick = (): void => {
    void onSubscribe(plan);
  };

  return (
    <Button className="w-full" variant={variant} disabled={isDisabled} onClick={handleClick}>
      {label}
    </Button>
  );
}

export function PricingCards({
  plans,
  currentPlan,
  onSubscribe,
  highlightPlan,
}: PricingCardsProps): JSX.Element {
  const [loading, setLoading] = useState<SubscriptionPlan | null>(null);

  const handleSubscribe = async (plan: SubscriptionPlan): Promise<void> => {
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
        const isHighlighted = highlightPlan === plan.plan;

        return (
          <Card
            key={plan.plan}
            data-plan={plan.plan}
            data-plan-selected={isHighlighted ? 'true' : undefined}
            className={cn(
              isPopular ? 'border-primary shadow-md' : '',
              isHighlighted ? 'ring-2 ring-[#8B5CF6]' : ''
            )}
          >
            <CardHeader>
              {isHighlighted && (
                <p className="text-xs font-medium uppercase text-[#8B5CF6]">
                  Selected for your trial
                </p>
              )}
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

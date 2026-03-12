import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { LandingPricingPlan } from '@/lib/landing/pricing';

interface PricingCardProps {
  plan: LandingPricingPlan;
}

function formatPrice(priceMonthly: number) {
  if (priceMonthly === 0) {
    return '$0';
  }

  return `$${Math.round(priceMonthly / 100)}`;
}

export function PricingCard({ plan }: PricingCardProps) {
  const isFeatured = plan.emphasis === 'featured';

  return (
    <Card
      data-testid="pricing-card"
      className={`flex h-full flex-col border-border bg-card/80 backdrop-blur-sm ${
        isFeatured ? 'border-primary shadow-lg shadow-primary/10' : ''
      }`}
    >
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-2xl text-foreground">{plan.name}</CardTitle>
          {isFeatured ? (
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Popular
            </span>
          ) : null}
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold text-foreground">{formatPrice(plan.priceMonthly)}</span>
          <span className="pb-1 text-sm text-muted-foreground">/month</span>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full" size="lg" variant={isFeatured ? 'default' : 'outline'}>
          <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

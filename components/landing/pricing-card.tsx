import type { JSX } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PricingPlanContent } from '@/lib/marketing/pricing-content';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';

interface PricingCardProps {
  plan: PricingPlanContent;
}

const AVAILABILITY_STYLES: Record<
  PricingPlanContent['featureBullets'][number]['availability'],
  string
> = {
  included: 'text-emerald-300',
  limited: 'text-amber-300',
  exclusive: 'text-sky-300',
};

export function PricingCard({ plan }: PricingCardProps): JSX.Element {
  return (
    <Card
      data-testid="plan-card"
      data-plan={plan.id}
      data-analytics-id={plan.analyticsId}
      className={cn(
        'flex h-full flex-col border-[#313244] bg-[#1e1e2e]/90 backdrop-blur-lg shadow-xl shadow-[#11111b]/50',
        plan.id === 'pro' ? 'ring-2 ring-[#8B5CF6]/80' : ''
      )}
    >
      <CardHeader className="space-y-3">
        {plan.badge ? (
          <Badge
            className={cn(
              'w-fit uppercase tracking-wide',
              plan.badge.tone === 'accent' && 'bg-[#f5c2e7]/20 text-[#f5c2e7] border-[#f5c2e7]/60'
            )}
          >
            {plan.badge.label}
          </Badge>
        ) : null}
        <CardTitle className="text-2xl text-[hsl(var(--ctp-text))]">
          {plan.name}
        </CardTitle>
        <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">{plan.description}</p>
        <div className="text-4xl font-bold text-[hsl(var(--ctp-text))]">
          {plan.priceDisplay}
        </div>
        {plan.pricePerMonth > 0 && (
          <p className="text-xs uppercase tracking-wide text-[hsl(var(--ctp-subtext-1))]">
            Billed monthly • {plan.cta.trialLengthDays}-day trial
          </p>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-5">
        <ul className="space-y-3">
          {plan.featureBullets.map((feature) => (
            <li key={feature.label} className="flex items-start gap-3">
              <span className={cn('mt-1', AVAILABILITY_STYLES[feature.availability])}>
                {feature.availability === 'included' ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </span>
              <div>
                <p className="text-sm font-medium text-[hsl(var(--ctp-text))]">{feature.label}</p>
                {feature.description ? (
                  <p className="text-xs text-[hsl(var(--ctp-subtext-1))]">{feature.description}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">{plan.limitsSummary}</p>
      </CardContent>
      <CardFooter>
        <Button
          asChild
          className="w-full"
          variant={plan.cta.style === 'secondary' ? 'secondary' : 'default'}
          data-analytics-id={plan.cta.analyticsId}
          data-plan={plan.id}
        >
          <Link href={plan.cta.href}>{plan.cta.label}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

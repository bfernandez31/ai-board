import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import type { PublicPlanSummary } from '@/lib/config/public-site';

interface PricingCardProps {
  plan: PublicPlanSummary;
}

export function PricingCard({ plan }: PricingCardProps): JSX.Element {
  const cardClassName = plan.highlighted
    ? 'flex h-full flex-col border-white/10 bg-[#11111b]/80 text-[hsl(var(--ctp-text))] shadow-lg shadow-black/20 border-[#8B5CF6] shadow-[#8B5CF6]/20'
    : 'flex h-full flex-col border-white/10 bg-[#11111b]/80 text-[hsl(var(--ctp-text))] shadow-lg shadow-black/20';

  const buttonVariant = plan.highlighted ? 'default' : 'outline';

  return (
    <Card className={cardClassName}>
      <CardHeader className="space-y-3">
        {plan.highlighted && (
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#cba6f7]">
            Most Popular
          </p>
        )}
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold leading-none tracking-tight">{plan.name}</h3>
          <CardDescription className="text-sm leading-6 text-[hsl(var(--ctp-subtext-0))]">
            {plan.tagline}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="space-y-3">
          {plan.capabilities.map((capability) => (
            <li key={capability} className="flex items-start gap-3 text-sm text-[hsl(var(--ctp-text))]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#a6e3a1]" aria-hidden="true" />
              <span>{capability}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button asChild size="lg" variant={buttonVariant} className="w-full">
          <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

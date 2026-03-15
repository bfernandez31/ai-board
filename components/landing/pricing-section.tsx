import { PLANS } from '@/lib/billing/plans';

import { PricingCard } from './pricing-card';
import { PricingFAQ } from './pricing-faq';

const PLAN_CARDS = [
  { ...PLANS.FREE, ctaLabel: 'Get Started', isPopular: false },
  { ...PLANS.PRO, ctaLabel: 'Start 14-day trial', isPopular: true },
  { ...PLANS.TEAM, ctaLabel: 'Start 14-day trial', isPopular: false },
 ] as const;

export function PricingSection(): JSX.Element {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="py-20 md:py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <p className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.3em] text-primary">
            Pricing
          </p>
          <h2
            id="pricing-title"
            className="mb-4 text-center text-4xl font-bold text-foreground md:text-5xl"
          >
            Simple, transparent pricing
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-xl text-muted-foreground">
            Start free and scale as your team grows. All plans include AI-powered development
            workflows.
          </p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLAN_CARDS.map((card) => (
              <PricingCard
                key={card.plan}
                name={card.name}
                price={card.priceMonthly}
                features={card.features}
                ctaLabel={card.ctaLabel}
                ctaHref="/auth/signin"
                isPopular={card.isPopular}
              />
            ))}
          </div>
          <PricingFAQ />
        </div>
      </div>
    </section>
  );
}

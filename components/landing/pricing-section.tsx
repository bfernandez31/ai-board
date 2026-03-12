import { PLANS } from '@/lib/billing/plans';
import { PricingCard } from './pricing-card';
import { PricingFAQ } from './pricing-faq';

const PLAN_CARDS = [
  { ...PLANS.FREE, ctaLabel: 'Get Started', isPopular: false },
  { ...PLANS.PRO, ctaLabel: 'Start 14-day trial', isPopular: true },
  { ...PLANS.TEAM, ctaLabel: 'Start 14-day trial', isPopular: false },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-16 md:py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-foreground mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Start free and scale as your team grows. All plans include AI-powered development workflows.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

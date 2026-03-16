import { PLANS } from '@/lib/billing/plans';
import { PricingCard } from './pricing-card';
import { PricingFAQ } from './pricing-faq';
import { getLandingSectionContent, LANDING_CTAS, PRICING_CALLOUTS } from '@/components/landing/content';

const PLAN_CARDS = [
  { ...PLANS.FREE, ctaLabel: 'Get Started Free', isPopular: false },
  { ...PLANS.PRO, ctaLabel: 'Start 14-day trial', isPopular: true },
  { ...PLANS.TEAM, ctaLabel: 'Start 14-day trial', isPopular: false },
];

const section = getLandingSectionContent('pricing');
const primaryCta = LANDING_CTAS['primary-sign-in'];

export function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="py-16 md:py-24 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              {section.eyebrow}
            </p>
            <h2 id="pricing-heading" className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              {section.heading}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
              {section.supportingText}
            </p>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-3">
            {PRICING_CALLOUTS.map((item) => (
              <p key={item} className="rounded-2xl border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
                {item}
              </p>
            ))}
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {PLAN_CARDS.map((card) => (
              <PricingCard
                key={card.plan}
                name={card.name}
                price={card.priceMonthly}
                features={card.features}
                ctaLabel={card.ctaLabel}
                ctaHref={primaryCta.href}
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

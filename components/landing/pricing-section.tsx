import { PricingCard } from '@/components/landing/pricing-card';
import { PricingFaq } from '@/components/landing/pricing-faq';
import {
  LANDING_PRICING_PLANS,
  LANDING_PRICING_SECTION_ID,
} from '@/lib/landing/pricing';

export function PricingSection(): JSX.Element {
  return (
    <section
      id={LANDING_PRICING_SECTION_ID}
      data-testid="pricing-section"
      className="border-y border-border bg-background/95 py-16 md:py-24 lg:py-32"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Pricing
            </p>
            <h2 className="mt-4 text-4xl font-bold text-foreground md:text-5xl">
              Choose the plan that fits your delivery pace
            </h2>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              Compare Free, Pro, and Team at a glance without leaving the landing page.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {LANDING_PRICING_PLANS.map((plan) => (
              <PricingCard key={plan.plan} plan={plan} />
            ))}
          </div>

          <PricingFaq />
        </div>
      </div>
    </section>
  );
}

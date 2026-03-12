import { PricingCard } from '@/components/landing/pricing-card';
import { PricingFaq } from '@/components/landing/pricing-faq';
import {
  PUBLIC_PLAN_SUMMARIES,
  PUBLIC_PRICING_FAQ_ITEMS,
} from '@/lib/config/public-site';

export function PricingSection(): JSX.Element {
  return (
    <section
      className="overflow-hidden bg-[radial-gradient(circle_at_top,#313244_0%,#1e1e2e_45%,#11111b_100%)] py-16 md:py-24 lg:py-32"
      data-testid="pricing-section"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-4xl font-bold text-[hsl(var(--ctp-text))] md:text-5xl">
              Choose the rollout that fits your team
            </h2>
            <p className="mt-4 text-lg leading-8 text-[hsl(var(--ctp-subtext-0))] md:text-xl">
              Compare the plans, keep sign-up simple, and move into AI-assisted delivery
              without leaving the page.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {PUBLIC_PLAN_SUMMARIES.map((plan) => (
              <PricingCard key={plan.name} plan={plan} />
            ))}
          </div>

          <div className="mt-8 md:mt-10">
            <PricingFaq items={PUBLIC_PRICING_FAQ_ITEMS} />
          </div>
        </div>
      </div>
    </section>
  );
}

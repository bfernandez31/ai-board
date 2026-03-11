import { PricingCard } from '@/components/landing/pricing-card';
import { Faq } from '@/components/landing/faq';
import { marketingContent } from '@/lib/marketing/pricing-content';

export function PricingSection() {
  return (
    <section
      data-testid="pricing-section"
      className="bg-[#11111b] py-16 md:py-24 lg:py-32"
      aria-labelledby="pricing-heading"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-sm uppercase tracking-widest text-[#cdd6f4]/70">Pricing</p>
          <h2 id="pricing-heading" className="mt-2 text-4xl font-bold text-[hsl(var(--ctp-text))] md:text-5xl">
            Choose the plan that fits your team
          </h2>
          <p className="mt-4 text-lg text-[hsl(var(--ctp-subtext-0))]">
            Predictable pricing tiers with built-in trials for growing AI teams.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {marketingContent.plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-8 lg:grid-cols-[2fr,1fr]">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#cdd6f4]/70">FAQs</p>
            <h3 className="mt-2 text-2xl font-semibold text-[hsl(var(--ctp-text))]">
              Answers for BYOK & supported agents
            </h3>
            <p className="mt-3 text-sm text-[hsl(var(--ctp-subtext-0))]">{marketingContent.faqIntro}</p>
            <div className="mt-6">
              <Faq items={marketingContent.faq} />
            </div>
          </div>
          <div className="rounded-2xl border border-[#313244] bg-[#1e1e2e]/70 p-6 text-left text-sm text-[hsl(var(--ctp-subtext-0))]">
            <p className="font-medium text-[hsl(var(--ctp-text))]">Need a custom plan?</p>
            <p className="mt-2">
              Reach out to support@ai-board.dev for enterprise seats, procurement paperwork, or to extend trial lengths beyond 14
              days.
            </p>
            <hr className="my-4 border-[#313244]" />
            <p>{marketingContent.disclaimer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

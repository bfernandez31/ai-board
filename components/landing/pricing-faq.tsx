import type { PublicPricingFaqItem } from '@/lib/config/public-site';

interface PricingFaqProps {
  items: PublicPricingFaqItem[];
}

export function PricingFaq({ items }: PricingFaqProps): JSX.Element {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#11111b]/70 p-6 sm:p-8">
      <div className="max-w-2xl">
        <h3 className="text-2xl font-semibold text-[hsl(var(--ctp-text))]">Pricing FAQ</h3>
        <p className="mt-2 text-sm leading-6 text-[hsl(var(--ctp-subtext-0))] sm:text-base">
          Common questions that come up before teams start a workflow.
        </p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.question} className="space-y-2">
            <h4 className="text-base font-semibold text-[hsl(var(--ctp-text))]">{item.question}</h4>
            <p className="text-sm leading-6 text-[hsl(var(--ctp-subtext-0))] sm:text-base">
              {item.answer}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

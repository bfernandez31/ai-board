import { LANDING_PRICING_FAQS } from '@/lib/landing/pricing';

export function PricingFaq() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {LANDING_PRICING_FAQS.map((entry) => (
        <article
          key={entry.id}
          className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm"
        >
          <h3 className="text-lg font-semibold text-foreground">{entry.question}</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{entry.answer}</p>
        </article>
      ))}
    </div>
  );
}

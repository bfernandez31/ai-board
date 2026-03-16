import { getLandingSectionContent, LANDING_CTAS, PROOF_SIGNALS } from '@/components/landing/content';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const section = getLandingSectionContent('proof');
const primaryCta = LANDING_CTAS['primary-sign-in'];

export function ProofStrip() {
  return (
    <section
      id="proof"
      aria-labelledby="proof-heading"
      className="border-y border-border bg-card/60 py-12 md:py-16"
      data-testid="proof-section"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] lg:items-start">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              {section.eyebrow}
            </p>
            <div className="space-y-3">
              <h2 id="proof-heading" className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                {section.heading}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                {section.supportingText}
              </p>
            </div>
            <Link href={primaryCta.href}>
              <Button size="lg" variant="outline" className="mt-2">
                {primaryCta.label}
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {PROOF_SIGNALS.map((signal) => (
              <article
                key={signal.title}
                className="rounded-2xl border border-border bg-background/80 p-5 shadow-sm"
              >
                <h3 className="text-base font-semibold text-foreground">{signal.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{signal.description}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

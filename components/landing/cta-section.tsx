import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getLandingSectionContent, LANDING_CTAS } from '@/components/landing/content';

const section = getLandingSectionContent('final-cta');
const primaryCta = LANDING_CTAS['primary-sign-in'];

export function CTASection() {
  return (
    <section
      id="final-cta"
      aria-labelledby="final-cta-heading"
      className="border-t border-border bg-muted/40 py-16 md:py-24 lg:py-28"
      data-testid="final-cta-section"
    >
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-background/90 px-6 py-10 text-center shadow-sm md:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            {section.eyebrow}
          </p>
          <h2 id="final-cta-heading" className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
            {section.heading}
          </h2>
          <p className="mt-6 text-base leading-7 text-muted-foreground md:text-lg">
            {section.supportingText}
          </p>
          <Link href={primaryCta.href}>
            <Button size="lg" className="mt-8">
              {primaryCta.label}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

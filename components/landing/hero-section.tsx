import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AnimatedTicketBackground from '@/app/landing/components/animated-ticket-background';
import { getLandingSectionContent, LANDING_CTAS } from '@/components/landing/content';

const section = getLandingSectionContent('hero');
const primaryCta = LANDING_CTAS['primary-sign-in'];
const secondaryCta = LANDING_CTAS['secondary-workflow'];

export function HeroSection() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-border py-16 md:py-24 lg:py-32"
    >
      <AnimatedTicketBackground className="absolute inset-0 -z-10" />
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-primary/10 via-background to-background" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">
              {section.eyebrow}
            </p>
            <h1
              id="hero-heading"
              className="mt-4 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-6xl lg:text-7xl"
            >
              {section.heading}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
              {section.supportingText}
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link href={primaryCta.href}>
                <Button size="lg" className="w-full sm:w-auto">
                  {primaryCta.label}
                </Button>
              </Link>
              <Link href={secondaryCta.href}>
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  {secondaryCta.label}
                </Button>
              </Link>
            </div>
          </div>

          <aside className="rounded-3xl border border-border bg-card/80 p-6 shadow-sm backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
              What visitors should understand in one pass
            </p>
            <ul className="mt-5 space-y-4">
              {[
                'AI Board turns a ticket into a spec, task plan, implementation run, and verification trail.',
                'The product is for teams that want AI help without losing reviewable process.',
                'The next step is simple: sign in, create a ticket, and follow the staged workflow.',
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground md:text-base">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  );
}

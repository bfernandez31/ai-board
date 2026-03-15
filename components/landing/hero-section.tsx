import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

import AnimatedTicketBackground from '@/app/landing/components/animated-ticket-background';
import { Button } from '@/components/ui/button';

const heroMetrics = [
  {
    value: '25%',
    label: 'Production-ready flow',
    description: 'Fewer workflow gaps once ticket context, plan, and verification live together.',
  },
  {
    value: '90 min',
    label: 'Team-visible progress',
    description: 'A faster path to shared status than jumping across docs, PRs, and CI logs.',
  },
  {
    value: '6 stages',
    label: 'Clear decision points',
    description: 'A board designed to show when AI should accelerate and when humans should step in.',
  },
] as const;

const trustPoints = [
  'Same palette, stronger hierarchy',
  'Accessible calls to action and landmarks',
  'Proof-first storytelling instead of generic SaaS copy',
] as const;

export function HeroSection(): JSX.Element {
  return (
    <section
      aria-labelledby="landing-hero-title"
      className="relative overflow-hidden border-b border-border/60 py-16 md:py-24 lg:py-28"
    >
      <AnimatedTicketBackground className="absolute inset-0 -z-10" />
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,hsl(var(--primary))_0%,transparent_55%)] opacity-25" />

      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-6 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              Purpose-built for AI-native delivery teams
            </div>
            <h1
              id="landing-hero-title"
              className="max-w-4xl text-5xl font-bold tracking-tight text-foreground md:text-6xl lg:text-7xl"
            >
              AI delivery, without the workflow chaos
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
              ai-board turns tickets into a visible, reviewable system of record so automation can
              move faster without leaving the team guessing what changed, what shipped, or what is
              blocked next.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="group w-full sm:w-auto">
                <Link href="/auth/signin">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="#workflow">See workflow</Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
                <Link href="#pricing">Explore pricing</Link>
              </Button>
            </div>

            <ul className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[2rem] border border-border/70 bg-card/80 p-6 shadow-2xl shadow-primary/10 backdrop-blur">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                  Delivery snapshot
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">
                  This week in ai-board
                </h2>
              </div>
              <span className="rounded-full border border-ctp-green/40 bg-ctp-green/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-ctp-green">
                Healthy
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-border/60 bg-background/70 p-4"
                >
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-bold text-foreground">{metric.value}</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{metric.label}</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      Live
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {metric.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

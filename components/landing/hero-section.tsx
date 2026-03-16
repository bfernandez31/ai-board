import Link from 'next/link';
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnimatedTicketBackground from '@/app/landing/components/animated-ticket-background';

interface HeroStat {
  value: string;
  label: string;
}

interface FocusItem {
  title: string;
  description: string;
}

const proofPoints = [
  'Built for AI-first product delivery',
  'Every step stays reviewable',
  'Designed for teams that need visible progress',
];

const stats: HeroStat[] = [
  { value: '5', label: 'delivery stages from intake to verification' },
  { value: '1', label: 'shared board for specs, jobs, and rollout' },
  { value: '0', label: 'extra status meetings to know what changed' },
];

const focusItems: FocusItem[] = [
  {
    title: 'Specification captured',
    description: 'Ticket scope, implementation notes, and rollout expectations stay attached.',
  },
  {
    title: 'Verification stays visible',
    description: 'Review, tests, and final decision points remain easy to audit later.',
  },
];

export function HeroSection(): React.JSX.Element {
  return (
    <section className="relative overflow-hidden border-b border-border/60 py-20 md:py-24 lg:py-32">
      <AnimatedTicketBackground className="absolute inset-0 -z-20 opacity-70" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,theme(colors.primary/.16),transparent_38%),linear-gradient(180deg,theme(colors.background/.92),theme(colors.background))]" />

      <div className="container relative mx-auto px-4">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="text-center lg:text-left">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card/80 px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" />
              AI delivery system with board-native workflow context
            </div>

            <h1 className="max-w-4xl text-balance text-5xl font-semibold tracking-tight text-foreground md:text-6xl lg:text-7xl">
              An AI delivery system for teams that ship
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
              Turn backlog chaos into a traceable shipping rhythm. AI Board keeps ticket intent,
              implementation flow, and release confidence in one place so your team can move fast
              without losing visibility.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
              <Button asChild size="lg" className="group">
                <Link href="/auth/signin">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-border bg-card/70">
                <Link href="#workflow">See workflow</Link>
              </Button>
            </div>

            <ul className="mt-8 flex flex-col gap-3 text-left sm:grid sm:grid-cols-2 sm:gap-4 lg:max-w-2xl">
              {proofPoints.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-full border border-border/70 bg-card/60 px-4 py-3 text-sm text-foreground backdrop-blur"
                >
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-primary/10 blur-3xl" aria-hidden="true" />
            <div className="relative overflow-hidden rounded-[2rem] border border-border/80 bg-card/85 p-6 shadow-2xl backdrop-blur xl:p-8">
              <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Live delivery board</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    Ship with less coordination drag
                  </p>
                </div>
                <div className="rounded-full border border-primary/30 bg-primary/10 p-3">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <p className="text-3xl font-semibold text-foreground">{stat.value}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-4 rounded-2xl border border-border/70 bg-background/60 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current focus</p>
                    <p className="text-base font-semibold text-foreground">
                      Ticket to shipped code without context loss
                    </p>
                  </div>
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    BUILD
                  </span>
                </div>

                <div className="grid gap-3">
                  {focusItems.map((item) => (
                    <div key={item.title} className="rounded-xl border border-border/70 bg-card px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

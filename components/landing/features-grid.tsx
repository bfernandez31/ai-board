import { GitBranch, Image, LayoutGrid, RefreshCw, Sparkles, Zap } from 'lucide-react';

import { FeatureCard } from './feature-card';

const features = [
  {
    icon: Sparkles,
    iconClassName: 'text-ctp-lavender',
    accentClassName: 'from-ctp-lavender/10',
    title: 'AI specs with fewer handoffs',
    description:
      'Move from rough ticket notes to a scoped implementation path with clearer prompts, stage context, and built-in guardrails.',
  },
  {
    icon: LayoutGrid,
    iconClassName: 'text-ctp-blue',
    accentClassName: 'from-ctp-blue/10',
    title: 'A board everyone can read',
    description:
      'Product, engineering, and operators share one view of where a ticket is blocked, moving, or ready for review.',
  },
  {
    icon: GitBranch,
    iconClassName: 'text-ctp-green',
    accentClassName: 'from-ctp-green/10',
    title: 'Branch and repo context included',
    description:
      'Keep workflow automation tied to the right repository, stage, and branch without asking teams to chase status in separate tools.',
  },
  {
    icon: Zap,
    iconClassName: 'text-ctp-yellow',
    accentClassName: 'from-ctp-yellow/10',
    title: 'Fast automation with human checkpoints',
    description:
      'Run quick implementations when work is simple, then fall back to deeper planning when a change needs more rigor.',
  },
  {
    icon: Image,
    iconClassName: 'text-ctp-pink',
    accentClassName: 'from-ctp-pink/10',
    title: 'Specs that keep visual context',
    description:
      'Attach screenshots, references, and notes so generated work stays aligned with product intent and review expectations.',
  },
  {
    icon: RefreshCw,
    iconClassName: 'text-ctp-sky',
    accentClassName: 'from-ctp-sky/10',
    title: 'Live status, not stale updates',
    description:
      'Poll jobs, comments, and notifications in one place so progress is visible while AI agents are still working.',
  },
] as const;

export function FeaturesGrid(): JSX.Element {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="relative overflow-hidden py-20 md:py-24 lg:py-32"
    >
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-card to-transparent" />
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Why teams switch to ai-board
            </p>
            <h2
              id="features-title"
              className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl"
            >
              One workspace for product, engineering, and AI agents
            </h2>
            <p className="text-lg leading-8 text-muted-foreground md:text-xl">
              Replace scattered tickets, docs, and workflow status with a board that makes AI
              delivery easier to trust and easier to ship.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

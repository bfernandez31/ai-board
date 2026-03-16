import { Bot, Eye, FolderKanban, GitBranch, ShieldCheck, TimerReset } from 'lucide-react';
import { FeatureCard } from './feature-card';

const features = [
  {
    icon: FolderKanban,
    iconClassName: 'text-primary',
    title: 'Clear ownership across every stage',
    description:
      'The board shows what is waiting for clarification, planned for implementation, actively building, and ready for verification.',
  },
  {
    icon: ShieldCheck,
    iconClassName: 'text-ctp-green',
    title: 'Built-in quality gates',
    description:
      'Verification, deployment checks, and workflow rollback rules are visible inside the same system that runs the work.',
  },
  {
    icon: Bot,
    iconClassName: 'text-ctp-blue',
    title: 'Shared context, not scattered prompts',
    description:
      'Ticket descriptions, AI instructions, specs, plans, and comments stay connected so the next step starts with context.',
  },
  {
    icon: GitBranch,
    iconClassName: 'text-ctp-lavender',
    title: 'Repository-aware automation',
    description:
      'Branching, implementation jobs, previews, and rollbacks are tied back to the ticket instead of being spread across tools.',
  },
  {
    icon: Eye,
    iconClassName: 'text-ctp-rosewater',
    title: 'Readable by humans under pressure',
    description:
      'Audit-friendly status, plain language stage labels, and high-contrast interfaces make the workflow usable during real delivery.',
  },
  {
    icon: TimerReset,
    iconClassName: 'text-ctp-teal',
    title: 'Workflow clarity without extra coordination layers',
    description:
      'Teams can understand what changed, what is blocked, and what ships next without building a parallel reporting habit.',
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="relative py-20 md:py-24 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 grid gap-8 rounded-[2rem] border border-border/70 bg-card/60 p-8 shadow-lg backdrop-blur lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                Why AI Board
              </p>
              <h2 className="mt-4 max-w-xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                Designed for calm, auditable execution
              </h2>
            </div>

            <div className="space-y-4">
              <p className="text-lg leading-8 text-muted-foreground">
                AI Board is for teams that want AI speed without losing operational clarity. The
                product keeps ticket intent, workflow state, and release confidence visible in one
                place.
              </p>
              <div className="rounded-2xl border border-border/70 bg-background/70 px-5 py-4 text-sm text-foreground">
                Workflow clarity without extra coordination layers
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

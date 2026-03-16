import { WorkflowStep } from './workflow-step';
import { MiniKanbanDemo } from './mini-kanban-demo';

const steps = [
  {
    stage: 'INBOX' as const,
    title: 'Capture the request where it starts',
    description: 'Bring in the ticket, keep the title honest, and give the workflow a clear starting point.',
  },
  {
    stage: 'SPECIFY' as const,
    title: 'Turn ambiguity into a shared spec',
    description: 'Clarify the job before implementation so AI output has direction instead of guesswork.',
  },
  {
    stage: 'PLAN' as const,
    title: 'Lock implementation intent',
    description: 'Define the technical path, affected files, and validation approach before code lands.',
  },
  {
    stage: 'BUILD' as const,
    title: 'Run the implementation with context attached',
    description: 'Branching, code changes, and workflow jobs stay connected to the same ticket trail.',
  },
  {
    stage: 'VERIFY' as const,
    title: 'Review before the last irreversible step',
    description: 'Tests, manual review, and rollback pathways remain visible until the team is ready to ship.',
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="py-20 md:py-24 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Delivery Workflow
            </p>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              One workflow from ticket intake to shipped code
            </h2>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Keep the board visible to everyone, let AI do the repetitive work, and preserve the
              human checkpoints that matter when quality and accountability are on the line.
            </p>
          </div>

          <div className="rounded-[2rem] border border-border/70 bg-card/60 p-5 shadow-lg backdrop-blur md:p-6">
            <MiniKanbanDemo className="max-w-7xl mx-auto" />
          </div>

          <div className="mt-10 grid gap-4">
            {steps.map((step, index) => (
              <WorkflowStep key={step.stage} {...step} isLast={index === steps.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

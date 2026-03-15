import { MiniKanbanDemo } from './mini-kanban-demo';
import { WorkflowStep, type WorkflowStepProps } from './workflow-step';

const workflowPrinciples = [
  {
    title: 'Clear ownership',
    description: 'Every ticket keeps its stage, branch, and repository context visible to the whole team.',
  },
  {
    title: 'Reviewable automation',
    description: 'AI can move quickly without hiding the checkpoints that matter before code ships.',
  },
  {
    title: 'Less coordination drag',
    description: 'Product, engineering, and QA can follow the same status language from backlog to verify.',
  },
] as const;

const workflowSteps: ReadonlyArray<WorkflowStepProps> = [
  {
    stage: 'INBOX',
    title: 'Capture the ticket once',
    description: 'Bring work in from your repo or create it directly without losing project context.',
  },
  {
    stage: 'SPECIFY',
    title: 'Shape the request',
    description: 'Generate a tighter spec with enough detail for AI to work without guesswork.',
  },
  {
    stage: 'PLAN',
    title: 'Make the implementation legible',
    description: 'Turn the spec into a practical plan that still respects architecture and test expectations.',
  },
  {
    stage: 'BUILD',
    title: 'Build with guardrails',
    description: 'Run implementation in automation while preserving enough structure for humans to review it.',
  },
  {
    stage: 'VERIFY',
    title: 'Verify before shipping',
    description: 'Keep final checks visible so teams can trust what is ready for production.',
  },
] as const;

export function WorkflowSection(): JSX.Element {

  return (
    <section
      id="workflow"
      aria-labelledby="workflow-title"
      className="relative overflow-hidden py-20 md:py-24 lg:py-32"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary))_0%,transparent_35%)] opacity-15" />
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-primary">
              Designed for reviewable AI delivery
            </p>
            <h2
              id="workflow-title"
              className="mb-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl"
            >
              A calmer path from ticket to shipped code
            </h2>
            <p className="text-lg leading-8 text-muted-foreground md:text-xl">
              ai-board keeps the workflow explicit, so teams can automate more work without making
              ownership, review, or deployment feel opaque.
            </p>
          </div>

          <div className="mb-10 grid gap-4 md:grid-cols-3">
            {workflowPrinciples.map((principle) => (
              <div
                key={principle.title}
                className="rounded-3xl border border-border/70 bg-card/70 p-6 backdrop-blur"
              >
                <h3 className="mb-2 text-lg font-semibold text-foreground">{principle.title}</h3>
                <p className="text-sm leading-6 text-muted-foreground">{principle.description}</p>
              </div>
            ))}
          </div>

          <div className="mb-16 hidden lg:block">
            <MiniKanbanDemo className="max-w-7xl mx-auto" />
          </div>

          <div className="flex flex-col gap-8 lg:hidden">
            {workflowSteps.map((step, index) => (
              <WorkflowStep
                key={step.stage}
                {...step}
                isLast={index === workflowSteps.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

import { WorkflowStep } from './workflow-step';
import { MiniKanbanDemo } from './mini-kanban-demo';

export function WorkflowSection() {
  const steps = [
    {
      stage: 'INBOX' as const,
      step: 1,
      title: 'Create ticket from issue',
      description: 'Import from your Git platform or create tickets manually',
    },
    {
      stage: 'SPECIFY' as const,
      step: 2,
      title: 'AI generates specification',
      description: 'Automated spec generation with intelligent clarification',
    },
    {
      stage: 'PLAN' as const,
      step: 3,
      title: 'Create implementation plan',
      description: 'Technical design with architecture guidelines',
    },
    {
      stage: 'BUILD' as const,
      step: 4,
      title: 'Execute implementation',
      description: 'Automated development through your CI/CD pipeline',
    },
    {
      stage: 'VERIFY' as const,
      step: 5,
      title: 'Review and deploy',
      description: 'Final validation before shipping to production',
    },
  ];

  return (
    <section
      id="workflow"
      className="py-16 md:py-24 lg:py-32"
      aria-labelledby="workflow-heading"
    >
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <h2
            id="workflow-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-foreground mb-4"
          >
            Streamlined Development Workflow
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Move your ideas from concept to production with a proven 5-stage workflow.
          </p>

          {/* Animated Mini-Kanban Demo - Desktop only */}
          <div className="hidden lg:block mb-16">
            <MiniKanbanDemo className="max-w-7xl mx-auto" />
          </div>

          {/* Detailed step descriptions - Mobile/Tablet only */}
          <ol className="flex flex-col gap-6 lg:hidden" aria-label="Workflow steps">
            {steps.map((step, index) => (
              <WorkflowStep
                key={step.stage}
                {...step}
                isLast={index === steps.length - 1}
              />
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

import { WorkflowStep } from './workflow-step';
import { MiniKanbanDemo } from './mini-kanban-demo';

export function WorkflowSection() {
  const steps = [
    {
      stage: 'INBOX' as const,
      title: 'Create ticket from issue',
      description: 'Import from your Git platform or create tickets manually',
    },
    {
      stage: 'SPECIFY' as const,
      title: 'AI generates specification',
      description: 'Automated spec generation with intelligent clarification',
    },
    {
      stage: 'PLAN' as const,
      title: 'Create implementation plan',
      description: 'Technical design with architecture guidelines',
    },
    {
      stage: 'BUILD' as const,
      title: 'Execute implementation',
      description: 'Automated development through your CI/CD pipeline',
    },
    {
      stage: 'VERIFY' as const,
      title: 'Review and deploy',
      description: 'Final validation before shipping to production',
    },
  ];

  return (
    <section id="workflow" className="py-16 md:py-24 lg:py-32">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-foreground mb-4">
            Streamlined Development Workflow
          </h2>
          <p className="text-xl text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Move your ideas from concept to production with a proven 6-stage workflow.
          </p>

          {/* Animated Mini-Kanban Demo - All viewports */}
          <div className="mb-12 lg:mb-16">
            <MiniKanbanDemo className="max-w-7xl mx-auto" />
          </div>

          {/* Detailed step descriptions - Mobile/Tablet supplementary view */}
          <div className="flex flex-col gap-6 lg:hidden">
            {steps.map((step, index) => (
              <WorkflowStep key={step.stage} {...step} isLast={index === steps.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

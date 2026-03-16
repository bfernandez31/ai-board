import { WorkflowStep } from './workflow-step';
import { MiniKanbanDemo } from './mini-kanban-demo';
import { getLandingSectionContent, LANDING_CTAS, WORKFLOW_STEPS } from '@/components/landing/content';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const section = getLandingSectionContent('workflow');
const secondaryCta = LANDING_CTAS['secondary-workflow'];

export function WorkflowSection() {
  return (
    <section id="workflow" aria-labelledby="workflow-heading" className="bg-muted/30 py-16 md:py-24 lg:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              {section.eyebrow}
            </p>
            <h2 id="workflow-heading" className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-5xl">
              {section.heading}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground md:text-lg">
              {section.supportingText}
            </p>
          </div>

          <div className="mt-12 hidden lg:block">
            <MiniKanbanDemo className="max-w-7xl mx-auto" />
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
            <div className="flex flex-col gap-8">
              {WORKFLOW_STEPS.map((step, index) => (
                <WorkflowStep key={step.stage} {...step} isLast={index === WORKFLOW_STEPS.length - 1} />
              ))}
            </div>

            <aside className="rounded-3xl border border-border bg-background/90 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">What makes this workflow different</h3>
              <ul className="mt-5 space-y-4">
                {[
                  'Each stage has a distinct purpose instead of blending planning, coding, and review together.',
                  'The board records the artifacts created along the way, so reviewers can inspect the work behind the output.',
                  'Conversion stays consistent: explore the workflow here, then sign in when you are ready to run it.',
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href={secondaryCta.href} className="mt-6 inline-flex">
                <Button variant="outline" size="lg">
                  {secondaryCta.label}
                </Button>
              </Link>
            </aside>
          </div>

          <div className="mt-10 flex flex-col gap-8 lg:hidden">
            {WORKFLOW_STEPS.map((step, index) => (
              <WorkflowStep key={step.stage} {...step} isLast={index === WORKFLOW_STEPS.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

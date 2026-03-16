interface WorkflowStepProps {
  stage: WorkflowStage;
  title: string;
  description: string;
  isLast?: boolean;
}

export type WorkflowStage = 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';

const stageClasses: Record<WorkflowStage, string> = {
  INBOX: 'bg-secondary text-secondary-foreground',
  SPECIFY: 'bg-ctp-lavender/25 text-ctp-lavender',
  PLAN: 'bg-ctp-blue/25 text-ctp-blue',
  BUILD: 'bg-ctp-peach/25 text-ctp-peach',
  VERIFY: 'bg-ctp-rosewater/25 text-ctp-rosewater',
};

export function WorkflowStep({
  stage,
  title,
  description,
  isLast = false,
}: WorkflowStepProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center" data-testid="workflow-step">
      <div className="flex-shrink-0">
        <div
          className={`inline-flex min-w-28 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold tracking-[0.2em] ${stageClasses[stage]}`}
        >
          {stage}
        </div>
      </div>

      <div className="flex-1 rounded-2xl border border-border/70 bg-card/60 px-5 py-4">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {!isLast && <div className="hidden flex-shrink-0 text-muted-foreground md:block">→</div>}
    </div>
  );
}

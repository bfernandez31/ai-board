interface WorkflowStepProps {
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  title: string;
  description: string;
  isLast?: boolean;
}

const stageClasses = {
  INBOX: 'bg-muted text-muted-foreground',
  SPECIFY: 'bg-ctp-lavender/20 text-ctp-lavender',
  PLAN: 'bg-ctp-blue/20 text-ctp-blue',
  BUILD: 'bg-ctp-peach/20 text-ctp-peach',
  VERIFY: 'bg-ctp-rosewater/20 text-ctp-rosewater',
};

export function WorkflowStep({ stage, title, description, isLast = false }: WorkflowStepProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center" data-testid="workflow-step">
      <div className="flex-shrink-0">
        <div className={`rounded-full px-4 py-2 text-sm font-bold ${stageClasses[stage]}`}>
          {stage}
        </div>
      </div>

      <div className="flex-1">
        <h3 className="mb-1 text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {!isLast && (
        <div className="hidden flex-shrink-0 text-muted-foreground md:block">→</div>
      )}
    </div>
  );
}

interface WorkflowStepProps {
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  step: number;
  title: string;
  description: string;
  isLast?: boolean;
}

const stageColorClasses: Record<WorkflowStepProps['stage'], { bg: string; text: string; border: string }> = {
  INBOX: { bg: 'bg-ctp-overlay0', text: 'text-ctp-crust', border: 'border-ctp-overlay0/30' },
  SPECIFY: { bg: 'bg-ctp-lavender', text: 'text-ctp-crust', border: 'border-ctp-lavender/30' },
  PLAN: { bg: 'bg-ctp-blue', text: 'text-ctp-crust', border: 'border-ctp-blue/30' },
  BUILD: { bg: 'bg-ctp-peach', text: 'text-ctp-crust', border: 'border-ctp-peach/30' },
  VERIFY: { bg: 'bg-ctp-flamingo', text: 'text-ctp-crust', border: 'border-ctp-flamingo/30' },
};

export function WorkflowStep({ stage, step, title, description, isLast = false }: WorkflowStepProps) {
  const colors = stageColorClasses[stage];

  return (
    <li
      className="relative flex items-start gap-4"
      data-testid="workflow-step"
    >
      {/* Step number + vertical connector */}
      <div className="flex flex-col items-center">
        <div
          className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${colors.bg} ${colors.text} text-sm font-bold`}
          aria-hidden="true"
        >
          {step}
        </div>
        {!isLast && (
          <div className="w-px flex-1 min-h-[2rem] bg-border mt-2" aria-hidden="true" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
        <div className={`inline-flex items-center gap-2 mb-1`}>
          <span
            className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${colors.bg} ${colors.text}`}
          >
            {stage}
          </span>
        </div>
        <h4 className="text-base font-semibold text-foreground mt-1">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground mt-0.5">
          {description}
        </p>
      </div>
    </li>
  );
}

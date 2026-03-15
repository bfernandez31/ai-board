import { cn } from '@/lib/utils';

export interface WorkflowStepProps {
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  title: string;
  description: string;
  isLast?: boolean;
}

const stageStyles: Record<WorkflowStepProps['stage'], string> = {
  INBOX: 'border-ctp-overlay0/40 bg-ctp-overlay0/10 text-ctp-subtext1',
  SPECIFY: 'border-ctp-lavender/40 bg-ctp-lavender/10 text-ctp-lavender',
  PLAN: 'border-ctp-blue/40 bg-ctp-blue/10 text-ctp-blue',
  BUILD: 'border-ctp-peach-light/40 bg-ctp-peach-light/10 text-ctp-peach-light',
  VERIFY: 'border-ctp-flamingo/40 bg-ctp-flamingo/10 text-ctp-flamingo',
};

export function WorkflowStep({
  stage,
  title,
  description,
  isLast = false,
}: WorkflowStepProps): JSX.Element {
  const stageBadgeClassName = cn(
    'rounded-full border px-4 py-2 text-sm font-bold',
    stageStyles[stage]
  );

  return (
    <div
      className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-card/70 p-5 md:flex-row md:items-center"
      data-testid="workflow-step"
    >
      <div className="flex-shrink-0">
        <div className={stageBadgeClassName}>{stage}</div>
      </div>

      <div className="flex-1">
        <h4 className="mb-1 text-base font-semibold text-foreground">{title}</h4>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      {!isLast && (
        <div className="hidden flex-shrink-0 text-muted-foreground/50 md:block">→</div>
      )}
    </div>
  );
}

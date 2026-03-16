interface WorkflowStepProps {
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  title: string;
  description: string;
  isLast?: boolean;
}

const stageBgClasses: Record<string, string> = {
  INBOX: 'bg-ctp-overlay0',
  SPECIFY: 'bg-ctp-lavender',
  PLAN: 'bg-ctp-blue',
  BUILD: 'bg-ctp-peach-light',
  VERIFY: 'bg-ctp-flamingo',
};

export function WorkflowStep({ stage, title, description, isLast = false }: WorkflowStepProps) {
  const bgClass = stageBgClasses[stage] || 'bg-ctp-overlay0';

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4" data-testid="workflow-step">
      {/* Stage badge */}
      <div className="flex-shrink-0">
        <div
          className={`px-4 py-2 rounded-full text-sm font-bold text-ctp-base ${bgClass}`}
        >
          {stage}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h4 className="text-base font-semibold text-foreground mb-1">
          {title}
        </h4>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      {/* Connector arrow (not shown for last item) */}
      {!isLast && (
        <div className="hidden md:block flex-shrink-0 text-ctp-surface0">
          →
        </div>
      )}
    </div>
  );
}

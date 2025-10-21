interface WorkflowStepProps {
  stage: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY';
  title: string;
  description: string;
  isLast?: boolean;
}

const stageColors = {
  INBOX: '#6c7086',    // Catppuccin overlay-0 (gray)
  SPECIFY: '#b4befe',  // Catppuccin lavender
  PLAN: '#89b4fa',     // Catppuccin blue
  BUILD: '#f9cb98',    // Catppuccin peach
  VERIFY: '#f2cdcd',   // Catppuccin flamingo
};

export function WorkflowStep({ stage, title, description, isLast = false }: WorkflowStepProps) {
  const color = stageColors[stage];

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4" data-testid="workflow-step">
      {/* Stage badge */}
      <div className="flex-shrink-0">
        <div
          className="px-4 py-2 rounded-full text-sm font-bold"
          style={{ backgroundColor: color, color: '#1e1e2e' }}
        >
          {stage}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        <h4 className="text-base font-semibold text-[hsl(var(--ctp-text))] mb-1">
          {title}
        </h4>
        <p className="text-sm text-[hsl(var(--ctp-subtext-0))]">
          {description}
        </p>
      </div>

      {/* Connector arrow (not shown for last item) */}
      {!isLast && (
        <div className="hidden md:block flex-shrink-0 text-[hsl(var(--ctp-surface-0))]">
          →
        </div>
      )}
    </div>
  );
}

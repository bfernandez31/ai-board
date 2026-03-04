import { Badge } from '@/components/ui/badge';
import { Agent } from '@prisma/client';
import { getAgentIcon, getAgentLabel } from '@/app/lib/utils/agent-icons';

interface AgentBadgeProps {
  agent: Agent;
  isOverride?: boolean;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  className?: string;
}

export function AgentBadge({
  agent,
  isOverride = false,
  variant = 'secondary',
  className = '',
}: AgentBadgeProps) {
  const icon = getAgentIcon(agent);
  const label = getAgentLabel(agent);

  return (
    <Badge
      variant={variant}
      className={`gap-1 ${className}`}
      data-testid="agent-badge"
    >
      <span>{icon}</span>
      <span className="text-xs" data-testid="agent-label">
        {label}
      </span>
      {isOverride && (
        <span
          className="text-xs text-muted-foreground"
          data-testid="agent-override-label"
        >
          (override)
        </span>
      )}
    </Badge>
  );
}

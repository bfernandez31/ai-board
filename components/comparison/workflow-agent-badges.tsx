'use client';

import { Agent, WorkflowType } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { AgentIcon } from '@/components/ui/agent-icon';
import { getAgentLabel } from '@/app/lib/utils/agent-icons';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const VALID_AGENTS = new Set<string>(Object.values(Agent));

function isValidAgent(value: string): value is Agent {
  return VALID_AGENTS.has(value);
}

interface WorkflowTypeBadgeProps {
  workflowType: WorkflowType;
}

export function WorkflowTypeBadge({ workflowType }: WorkflowTypeBadgeProps) {
  if (workflowType === 'QUICK') {
    return (
      <Badge
        variant="outline"
        className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 shrink-0 px-1.5 py-0.5 font-semibold"
      >
        ⚡ Quick
      </Badge>
    );
  }
  if (workflowType === 'CLEAN') {
    return (
      <Badge
        variant="outline"
        className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 shrink-0 px-1.5 py-0.5 font-semibold flex items-center gap-1"
      >
        <Sparkles className="h-3 w-3" />
        Clean
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs shrink-0 px-1.5 py-0.5 font-semibold">
      Full
    </Badge>
  );
}

interface AgentTooltipIconProps {
  agent: string | null;
  size?: number;
}

export function AgentTooltipIcon({ agent, size = 16 }: AgentTooltipIconProps) {
  if (!agent || !isValidAgent(agent)) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span data-testid="comparison-agent-icon" className="shrink-0">
          <AgentIcon agent={agent} size={size} />
        </span>
      </TooltipTrigger>
      <TooltipContent>{getAgentLabel(agent)}</TooltipContent>
    </Tooltip>
  );
}

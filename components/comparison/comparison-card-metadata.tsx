'use client';

import { Agent, type WorkflowType } from '@prisma/client';
import { Sparkles } from 'lucide-react';
import { getAgentLabel, inferAgentFromIdentifier } from '@/app/lib/utils/agent-icons';
import { AgentIcon } from '@/components/ui/agent-icon';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ComparisonCardMetadataProps {
  workflowType: WorkflowType;
  agent: string | null;
  iconSize: number;
  className?: string;
}

function WorkflowTypeBadge({ workflowType }: { workflowType: WorkflowType }): JSX.Element {
  switch (workflowType) {
    case 'QUICK':
      return (
        <Badge
          variant="attribute"
          kind="scope"
          scope="quick"
          data-testid="comparison-workflow-badge"
          className="shrink-0"
        >
          Quick
        </Badge>
      );

    case 'CLEAN':
      return (
        <Badge
          variant="secondary"
          data-testid="comparison-workflow-badge"
          className="shrink-0 inline-flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" />
          Clean
        </Badge>
      );

    default:
      return (
        <Badge
          variant="attribute"
          kind="scope"
          scope="full"
          data-testid="comparison-workflow-badge"
          className="shrink-0"
        >
          FULL
        </Badge>
      );
  }
}

export function ComparisonCardMetadata({
  workflowType,
  agent,
  iconSize,
  className,
}: ComparisonCardMetadataProps): JSX.Element {
  const resolvedAgent = inferAgentFromIdentifier(agent) ?? Agent.CLAUDE;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span data-testid="comparison-agent-badge" className="shrink-0">
            <AgentIcon agent={resolvedAgent} size={iconSize} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{getAgentLabel(resolvedAgent)}</TooltipContent>
      </Tooltip>
      <WorkflowTypeBadge workflowType={workflowType} />
    </div>
  );
}

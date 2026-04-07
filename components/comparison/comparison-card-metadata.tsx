'use client';

import type { WorkflowType } from '@prisma/client';
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
  const baseClassName = 'shrink-0 px-1.5 py-0.5 text-xs font-semibold';

  switch (workflowType) {
    case 'QUICK':
      return (
        <Badge
          variant="outline"
          data-testid="comparison-workflow-badge"
          className={`${baseClassName} bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200`}
        >
          ⚡ Quick
        </Badge>
      );

    case 'CLEAN':
      return (
        <Badge
          variant="outline"
          data-testid="comparison-workflow-badge"
          className={`flex items-center gap-1 ${baseClassName} bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200`}
        >
          <Sparkles className="h-3 w-3" />
          Clean
        </Badge>
      );

    default:
      return (
        <Badge
          variant="outline"
          data-testid="comparison-workflow-badge"
          className={baseClassName}
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
  const resolvedAgent = inferAgentFromIdentifier(agent);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {resolvedAgent && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span data-testid="comparison-agent-badge" className="shrink-0">
              <AgentIcon agent={resolvedAgent} size={iconSize} />
            </span>
          </TooltipTrigger>
          <TooltipContent>{getAgentLabel(resolvedAgent)}</TooltipContent>
        </Tooltip>
      )}
      <WorkflowTypeBadge workflowType={workflowType} />
    </div>
  );
}

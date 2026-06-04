'use client';

import { Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TokenSavingBadgeProps {
  isOverride: boolean;
  className?: string;
}

export function TokenSavingBadge({ isOverride, className }: TokenSavingBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className={className}
            data-testid="token-saving-badge"
          >
            <Zap className="h-3 w-3 mr-1" />
            <span>Token saving</span>
            {isOverride && <span className="opacity-70 ml-1">(override)</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Token saving is {isOverride ? 'overridden on this ticket' : 'inherited from project default'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

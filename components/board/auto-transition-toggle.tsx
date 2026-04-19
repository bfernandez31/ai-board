'use client';

import * as React from 'react';
import { ChevronsRight } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface AutoTransitionToggleProps {
  enabled: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

/**
 * Fast-forward toggle on a ticket card to enable/disable auto-transition mode.
 *
 * Off: visible only on card hover (matches cancel icon pattern).
 * On: always visible with accent color.
 */
export const AutoTransitionToggle = React.memo(
  ({ enabled, onClick, disabled }: AutoTransitionToggleProps) => {
    const tooltip = enabled
      ? 'Auto-transition on — click to disable'
      : 'Enable auto-transition';

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClick(e);
            }}
            disabled={disabled}
            data-testid="auto-transition-toggle"
            data-enabled={enabled ? 'true' : 'false'}
            aria-label={tooltip}
            aria-pressed={enabled}
            className={`transition-opacity p-0.5 rounded hover:bg-accent/40 ${
              enabled
                ? 'opacity-100 text-primary'
                : 'opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground'
            }`}
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
);

AutoTransitionToggle.displayName = 'AutoTransitionToggle';

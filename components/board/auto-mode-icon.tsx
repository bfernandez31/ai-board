'use client';

import * as React from 'react';
import { FastForward } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface AutoModeIconProps {
  autoMode: boolean;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
}

export const AutoModeIcon = React.memo(
  ({ autoMode, onClick, disabled = false }: AutoModeIconProps) => {
    const tooltip = autoMode
      ? 'Auto-transition on — click to disable'
      : 'Enable auto-transition';

    const baseClass =
      'p-0.5 rounded inline-flex items-center justify-center text-muted-foreground transition-opacity hover:text-foreground';
    const stateClass = autoMode
      ? 'opacity-100 ring-2 ring-indigo-500 dark:ring-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)] text-indigo-500 dark:text-indigo-400'
      : 'opacity-0 group-hover:opacity-100';

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={tooltip}
            aria-pressed={autoMode}
            data-testid="auto-mode-icon"
            data-auto-mode={autoMode ? 'on' : 'off'}
            className={`${baseClass} ${stateClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <FastForward className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
);

AutoModeIcon.displayName = 'AutoModeIcon';

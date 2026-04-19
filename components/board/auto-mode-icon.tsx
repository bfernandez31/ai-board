'use client';

import * as React from 'react';
import { ChevronsRight } from 'lucide-react';
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

    const buttonClass = autoMode
      ? 'inline-flex items-center justify-center rounded disabled:opacity-40 disabled:cursor-not-allowed'
      : 'opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded inline-flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed';

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
            className={buttonClass}
          >
            {autoMode ? (
              <span
                className="auto-transition-glyph"
                title="Transition automatique en cours"
                aria-label="Auto-transition"
                role="img"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="7 6 13 12 7 18" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
              </span>
            ) : (
              <ChevronsRight className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    );
  }
);

AutoModeIcon.displayName = 'AutoModeIcon';

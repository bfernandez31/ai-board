'use client';

import * as React from 'react';

import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TicketCardDeployIconProps {
  /** Callback when deploy button is clicked */
  onDeploy: () => void;
  /** Ticket key for accessibility label */
  ticketKey: string;
  /** Whether deployment is in progress */
  isDeploying?: boolean;
  /** Whether deploy is disabled due to another ticket's active deployment */
  isDisabled?: boolean;
}

/**
 * Deploy Icon Component
 *
 * Displays a clickable deploy (rocket) icon that triggers the deployment flow.
 * Opens confirmation modal when clicked. Shown only when ticket is deployable
 * (stage=VERIFY, has branch, latest job COMPLETED).
 *
 * @example
 * ```tsx
 * {isDeployable && (
 *   <TicketCardDeployIcon
 *     onDeploy={() => setShowModal(true)}
 *     ticketKey={ticket.ticketKey}
 *     isDeploying={isPending}
 *   />
 * )}
 * ```
 */
export const TicketCardDeployIcon = React.memo(
  ({ onDeploy, ticketKey, isDeploying = false, isDisabled = false }: TicketCardDeployIconProps) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent ticket card click event
      if (!isDisabled) {
        onDeploy();
      }
    };

    const tooltipText = isDeploying
      ? 'Deployment in progress...'
      : isDisabled
      ? 'Another deployment is in progress'
      : 'Deploy preview to Vercel';

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-[#313244] text-[#a6adc8] hover:text-[#cdd6f4] disabled:opacity-50"
              onClick={handleClick}
              disabled={isDeploying || isDisabled}
              aria-label={`Deploy preview for ${ticketKey}`}
              data-testid="deploy-icon"
            >
              <Rocket className={`h-4 w-4 ${isDeploying ? 'animate-pulse' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

TicketCardDeployIcon.displayName = 'TicketCardDeployIcon';

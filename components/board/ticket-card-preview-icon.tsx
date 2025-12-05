'use client';

import * as React from 'react';

import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TicketCardPreviewIconProps {
  /** Vercel preview URL */
  previewUrl: string;
  /** Ticket key for accessibility label */
  ticketKey: string;
}

/**
 * Preview Icon Component
 *
 * Displays a clickable external link icon that opens the Vercel preview deployment
 * in a new tab. Shown only when ticket has an active preview URL.
 *
 * @example
 * ```tsx
 * {ticket.previewUrl && (
 *   <TicketCardPreviewIcon
 *     previewUrl={ticket.previewUrl}
 *     ticketKey={ticket.ticketKey}
 *   />
 * )}
 * ```
 */
export const TicketCardPreviewIcon = React.memo(
  ({ previewUrl, ticketKey }: TicketCardPreviewIconProps) => {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent ticket card click event
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-[#313244]"
              onClick={handleClick}
              aria-label={`Open preview deployment for ${ticketKey}`}
              data-testid="preview-icon"
            >
              <ExternalLink className="h-4 w-4 text-green-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Open preview deployment</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

TicketCardPreviewIcon.displayName = 'TicketCardPreviewIcon';

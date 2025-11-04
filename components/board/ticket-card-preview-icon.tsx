'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 hover:bg-[#313244] text-[#a6adc8] hover:text-[#cdd6f4]"
        onClick={handleClick}
        aria-label={`Open preview deployment for ${ticketKey}`}
        title="Preview deployment completed"
        data-testid="preview-icon"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
    );
  }
);

TicketCardPreviewIcon.displayName = 'TicketCardPreviewIcon';

'use client';

import React, { useState, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TicketWithVersion } from '@/lib/types';
import { JobStatusIndicator } from './job-status-indicator';
import { Job } from '@prisma/client';
import { classifyJobType } from '@/lib/utils/job-type-classifier';

interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  currentJob?: Job | null;
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
}

/**
 * TicketCard Component - Original Design with Drag-and-Drop
 */
export const TicketCard = React.memo(
  ({ ticket, currentJob, isDraggable = true, onTicketClick }: DraggableTicketCardProps) => {
    const [isMounted, setIsMounted] = useState(false);

    const { attributes, listeners, setNodeRef, transform, isDragging } =
      useDraggable({
        id: `ticket-${ticket.id}`,
        data: {
          ticket,
          type: 'ticket',
        },
        disabled: !isDraggable,
      });

    // Only apply drag attributes after client-side hydration to prevent SSR mismatch
    useEffect(() => {
      setIsMounted(true);
    }, []);

    const style = transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        }
      : undefined;

    // Click handler that respects drag state
    const handleClick = () => {
      // Prevent click during drag
      if (!isDragging && onTicketClick) {
        onTicketClick(ticket);
      }
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        data-ticket-id={ticket.id}
        data-testid="ticket-card"
        data-draggable={isDraggable ? 'true' : 'false'}
        onClick={handleClick}
        className={`
        transition-opacity touch-none
        ${isDragging ? 'opacity-30' : 'opacity-100'}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-60'}
      `}
        {...(isMounted ? attributes : {})}
        {...(isMounted ? listeners : {})}
      >
        <Card
          className="bg-[#181825] border-[#313244] p-4 transition-all hover:border-[#45475a] hover:bg-[#1e1e2e] overflow-hidden shadow-sm"
          role="article"
          aria-label={`Ticket ${ticket.id}: ${ticket.title}`}
        >
          {/* Header: ID and Badges */}
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs text-[#a6adc8] font-mono font-semibold">
              #{ticket.id}
            </span>
            <div className="flex items-center gap-2">
              {ticket.workflowType === 'QUICK' && (
                <Badge
                  variant="outline"
                  className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 shrink-0 px-1.5 py-0.5 font-semibold"
                >
                  ⚡ Quick
                </Badge>
              )}
              <Badge className="bg-[#89b4fa]/20 text-[#89b4fa] border-[#89b4fa]/50 hover:bg-[#89b4fa]/30 text-xs px-2 py-0.5 font-semibold">
                SONNET
              </Badge>
            </div>
          </div>

          {/* Title */}
          <h3
            className="font-semibold text-sm line-clamp-2 text-[#cdd6f4] break-all overflow-hidden mb-3"
            title={ticket.title}
          >
            {ticket.title}
          </h3>

          {/* Job Status Indicator */}
          {currentJob && (
            <div className="border-t border-[#313244] pt-3">
              <JobStatusIndicator
                status={currentJob.status}
                command={currentJob.command}
                jobType={classifyJobType(currentJob.command)}
                animated={true}
              />
            </div>
          )}
        </Card>
      </div>
    );
  }
);

TicketCard.displayName = 'TicketCard';

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
  currentJob?: Job | null; // Legacy: kept for backward compatibility
  workflowJob?: Job | null; // User Story 1: Workflow job display
  aiBoardJob?: Job | null; // User Story 2: AI-BOARD job display
  isDraggable?: boolean;
  onTicketClick?: (ticket: TicketWithVersion) => void;
}

/**
 * TicketCard Component - Original Design with Drag-and-Drop
 */
export const TicketCard = React.memo(
  ({ ticket, workflowJob, aiBoardJob, isDraggable = true, onTicketClick }: DraggableTicketCardProps) => {
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
          aria-label={`Ticket ${ticket.ticketKey}: ${ticket.title}`}
        >
          {/* Header: Ticket Key and Badges */}
          <div className="flex items-start justify-between mb-3">
            <span className="text-xs text-[#a6adc8] font-mono font-semibold">
              {ticket.ticketKey}
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
            className="font-semibold text-sm line-clamp-2 text-[#cdd6f4] break-words overflow-hidden mb-3"
            title={ticket.title}
          >
            {ticket.title}
          </h3>

          {/* Job Status Indicators (Single-line layout with right-aligned AI-BOARD) */}
          {(workflowJob || aiBoardJob) && (
            <div className="border-t border-[#313244] pt-3">
              <div className="flex items-center justify-between gap-3">
                {/* Left: Workflow Job Indicator (simplified display) */}
                {workflowJob && (
                  <JobStatusIndicator
                    status={workflowJob.status}
                    command={workflowJob.command}
                    jobType={classifyJobType(workflowJob.command)}
                    stage={ticket.stage}
                    animated={true}
                    completedAt={workflowJob.completedAt}
                  />
                )}

                {/* Right: AI-BOARD Job Indicator (compact icon-only) */}
                {aiBoardJob && (
                  <JobStatusIndicator
                    status={aiBoardJob.status}
                    command={aiBoardJob.command}
                    jobType={classifyJobType(aiBoardJob.command)}
                    stage={ticket.stage}
                    animated={true}
                    completedAt={aiBoardJob.completedAt}
                  />
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    );
  }
);

TicketCard.displayName = 'TicketCard';

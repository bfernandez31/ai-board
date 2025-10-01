'use client';

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TicketWithVersion } from '@/lib/types';

interface DraggableTicketCardProps {
  ticket: TicketWithVersion;
  isDraggable?: boolean;
}

/**
 * TicketCard Component - Original Design with Drag-and-Drop
 */
export const TicketCard = React.memo(({ ticket, isDraggable = true }: DraggableTicketCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ticket-${ticket.id}`,
    data: {
      ticket,
      type: 'ticket',
    },
    disabled: !isDraggable,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-ticket-id={ticket.id}
      data-testid="ticket-card"
      data-draggable={isDraggable ? 'true' : 'false'}
      className={`
        transition-opacity
        ${isDragging ? 'opacity-30' : 'opacity-100'}
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-60'}
      `}
      {...attributes}
      {...listeners}
    >
      <Card
        className="bg-zinc-900 border-zinc-700 p-4 transition-all hover:border-zinc-600 hover:bg-zinc-800 overflow-hidden"
        role="article"
        aria-label={`Ticket ${ticket.id}: ${ticket.title}`}
      >
        {/* Header: ID and Badge */}
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs text-zinc-400 font-mono font-semibold">#{ticket.id}</span>
          <Badge className="bg-blue-600 text-blue-50 border-blue-500 hover:bg-blue-700 text-xs px-2 py-0.5 font-semibold">
            SONNET
          </Badge>
        </div>

        {/* Title - truncated at 2 lines */}
        <h3 className="font-semibold text-sm mb-3 line-clamp-2 text-zinc-100 break-all overflow-hidden" title={ticket.title}>
          {ticket.title}
        </h3>

        {/* Metadata */}
        <div className="border-t border-zinc-700 pt-3">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">
            MESSAGES/TOOLS PER AGENT
          </div>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-blue-300 font-semibold">PLAN</span>
              <span className="text-xs text-zinc-400 font-medium">0 · 0</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-green-300 font-semibold">BUILD</span>
              <span className="text-xs text-zinc-400 font-medium">0 · 0</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-orange-300 font-semibold">VERIFY</span>
              <span className="text-xs text-zinc-400 font-medium">0 · 0</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
});

TicketCard.displayName = 'TicketCard';
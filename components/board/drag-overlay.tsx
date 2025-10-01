'use client';

import React from 'react';
import { DragOverlay as DndKitDragOverlay } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { TicketWithVersion } from '@/lib/types';

interface DragOverlayProps {
  activeTicket: TicketWithVersion | null;
}

/**
 * DragOverlay Component
 *
 * Renders a preview of the ticket being dragged
 * Follows the cursor during drag operation
 *
 * @param activeTicket - The ticket currently being dragged, or null if no drag in progress
 */
export const DragOverlay = ({ activeTicket }: DragOverlayProps) => {
  return (
    <DndKitDragOverlay>
      {activeTicket ? (
        <div className="opacity-80 cursor-grabbing rotate-3 scale-105 transition-transform">
          <Card className="bg-zinc-900 border-zinc-600 p-4 shadow-2xl">
            {/* Header: ID and Version */}
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-zinc-400 font-mono font-semibold">
                #{activeTicket.id}
              </span>
              <span className="text-xs text-zinc-500 font-medium">
                v{activeTicket.version}
              </span>
            </div>

            {/* Title - truncated at 2 lines */}
            <h3 className="font-semibold text-sm mb-2 line-clamp-2 text-zinc-100 break-words">
              {activeTicket.title}
            </h3>

            {/* Stage */}
            <div className="text-xs text-zinc-400 font-medium">
              Stage: {activeTicket.stage}
            </div>
          </Card>
        </div>
      ) : null}
    </DndKitDragOverlay>
  );
};

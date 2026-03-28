'use client';

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
        <div className="opacity-90 cursor-grabbing rotate-2 scale-110 transition-transform touch-none">
          <Card className="aurora-bg-section border-ctp-blue border-2 p-4 shadow-2xl">
            {/* Header: ID and Version */}
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-muted-foreground font-mono font-semibold">
                #{activeTicket.id}
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                v{activeTicket.version}
              </span>
            </div>

            {/* Title - truncated at 2 lines */}
            <h3 className="font-semibold text-sm mb-2 line-clamp-2 text-foreground break-words">
              {activeTicket.title}
            </h3>

            {/* Stage */}
            <div className="text-xs text-ctp-blue font-medium">
              Stage: {activeTicket.stage}
            </div>
          </Card>
        </div>
      ) : null}
    </DndKitDragOverlay>
  );
};

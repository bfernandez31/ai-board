'use client';

import * as React from 'react';

import { useDroppable } from '@dnd-kit/core';
import { Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Props for CloseZone component
 */
export interface CloseZoneProps {
  /**
   * Whether the close zone should be visible (true when dragging VERIFY ticket)
   */
  isVisible: boolean;

  /**
   * Whether the close zone is disabled (true for tickets with active jobs or during cleanup)
   */
  isDisabled: boolean;

  /**
   * Optional reason why close zone is disabled (for tooltip)
   */
  disabledReason?: string | undefined;
}

/**
 * Close zone droppable component for closing tickets via drag-and-drop
 *
 * Features:
 * - Fixed viewport positioning (bottom-right, next to trash zone)
 * - Conditional rendering based on drag state (only VERIFY tickets)
 * - Visual feedback on hover (red border when enabled)
 * - Disabled state with tooltip explanation
 * - Smooth transitions (200ms duration)
 *
 * @param props - CloseZoneProps
 * @returns Close zone droppable component or null if not visible
 *
 * @example
 * ```typescript
 * <CloseZone
 *   isVisible={dragSource === 'VERIFY'}
 *   isDisabled={hasActiveJobs}
 *   disabledReason="Cannot close ticket with active jobs"
 * />
 * ```
 */
export const CloseZone = React.memo(function CloseZone({ isVisible, isDisabled, disabledReason }: CloseZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'close-zone',
    disabled: isDisabled,
    data: {
      stage: 'CLOSED',
      type: 'close-zone',
    },
  });

  // Don't render if not visible
  if (!isVisible) return null;

  const closeZoneContent = (
    <div
      ref={setNodeRef}
      data-testid="close-zone"
      className={cn(
        // Fixed positioning (bottom-right, offset from trash zone)
        'fixed bottom-4 right-8 z-50',
        // Base styles
        'border-2 border-dashed rounded-lg p-4 bg-white shadow-lg',
        // Layout
        'flex items-center gap-2',
        // Transitions
        'transition-all duration-200',
        // Hover state (enabled - red border and icon)
        isOver && !isDisabled && 'border-red-500 bg-red-50',
        // Disabled state (grayed out, no pointer events)
        isDisabled && 'opacity-50 cursor-not-allowed border-gray-300'
      )}
    >
      <Archive
        className={cn(
          'w-6 h-6 transition-colors duration-200',
          isOver && !isDisabled && 'text-red-500',
          isDisabled && 'text-gray-400'
        )}
      />
      <span
        className={cn(
          'font-medium transition-colors duration-200',
          isOver && !isDisabled && 'text-red-500',
          isDisabled && 'text-gray-400'
        )}
      >
        Close Ticket
      </span>
    </div>
  );

  // Wrap in tooltip if disabled and reason is provided
  if (isDisabled && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{closeZoneContent}</TooltipTrigger>
          <TooltipContent>
            <p>{disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return closeZoneContent;
});

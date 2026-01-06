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
   * Whether the close zone should be visible (true when dragging from VERIFY)
   */
  isVisible: boolean;

  /**
   * Whether the close zone is disabled (true when ticket has active jobs)
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
 * - Rendered inside SHIP column (bottom 40%) when dragging from VERIFY
 * - Red dashed border with Archive icon
 * - Visual feedback on hover
 * - Disabled state with tooltip explanation
 * - Smooth transitions (200ms duration)
 *
 * @param props - CloseZoneProps
 * @returns Close zone droppable component or null if not visible
 *
 * @example
 * ```typescript
 * <CloseZone
 *   isVisible={isDraggingFromVerify}
 *   isDisabled={hasActiveJobs}
 *   disabledReason="Cannot close: workflow is still running"
 * />
 * ```
 */
export const CloseZone = React.memo(function CloseZone({
  isVisible,
  isDisabled,
  disabledReason,
}: CloseZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'close-zone',
    disabled: isDisabled,
  });

  // Don't render if not visible
  if (!isVisible) return null;

  const closeZoneContent = (
    <div
      ref={setNodeRef}
      data-testid="close-zone"
      className={cn(
        // Base styles
        'border-2 border-dashed rounded-lg p-3',
        // Layout
        'flex flex-col items-center justify-center gap-2',
        // Height (40% of parent)
        'flex-[4]',
        // Transitions
        'transition-all duration-200',
        // Default state (red theme)
        'border-red-400/60 bg-red-50/50',
        // Hover state (enabled - more prominent red)
        isOver && !isDisabled && 'border-red-500 bg-red-100/80 shadow-inner',
        // Disabled state (grayed out, no pointer events)
        isDisabled && 'opacity-50 cursor-not-allowed border-gray-300 bg-gray-50'
      )}
    >
      <Archive
        className={cn(
          'w-6 h-6 transition-colors duration-200',
          !isDisabled && 'text-red-500',
          isOver && !isDisabled && 'text-red-600',
          isDisabled && 'text-gray-400'
        )}
      />
      <span
        className={cn(
          'text-sm font-medium transition-colors duration-200 text-center',
          !isDisabled && 'text-red-600',
          isOver && !isDisabled && 'text-red-700',
          isDisabled && 'text-gray-400'
        )}
      >
        Close Without Shipping
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

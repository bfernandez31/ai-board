'use client';

import { useDroppable } from '@dnd-kit/core';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Props for TrashZone component
 */
export interface TrashZoneProps {
  /**
   * Whether the trash zone should be visible (true when dragging)
   */
  isVisible: boolean;

  /**
   * Whether the trash zone is disabled (true for SHIP stage or tickets with active jobs)
   */
  isDisabled: boolean;

  /**
   * Optional reason why trash zone is disabled (for tooltip)
   */
  disabledReason?: string | undefined;
}

/**
 * Trash zone droppable component for deleting tickets via drag-and-drop
 *
 * Features:
 * - Fixed viewport positioning (bottom-center)
 * - Conditional rendering based on drag state
 * - Visual feedback on hover (red border when enabled)
 * - Disabled state with tooltip explanation
 * - Smooth transitions (200ms duration)
 *
 * @param props - TrashZoneProps
 * @returns Trash zone droppable component or null if not visible
 *
 * @example
 * ```typescript
 * <TrashZone
 *   isVisible={activeId !== null}
 *   isDisabled={activeTicket?.stage === 'SHIP'}
 *   disabledReason="SHIP stage tickets cannot be deleted"
 * />
 * ```
 */
export function TrashZone({ isVisible, isDisabled, disabledReason }: TrashZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'trash-zone',
    disabled: isDisabled,
  });

  // Don't render if not visible
  if (!isVisible) return null;

  const trashZoneContent = (
    <div
      ref={setNodeRef}
      data-testid="trash-zone"
      className={cn(
        // Fixed positioning (bottom-center)
        'fixed bottom-4 left-1/2 -translate-x-1/2 z-50',
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
      <Trash2
        className={cn(
          'w-6 h-6 transition-colors duration-200',
          isOver && !isDisabled && 'text-red-500',
          isDisabled && 'text-gray-400'
        )}
      />
      <span className={cn('font-medium', isDisabled && 'text-gray-400')}>
        Delete Ticket
      </span>
    </div>
  );

  // Wrap in tooltip if disabled and reason is provided
  if (isDisabled && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{trashZoneContent}</TooltipTrigger>
          <TooltipContent>
            <p>{disabledReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return trashZoneContent;
}

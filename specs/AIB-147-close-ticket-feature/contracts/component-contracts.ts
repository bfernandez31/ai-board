/**
 * Component Contracts: Close Ticket Feature
 *
 * Feature: AIB-147-close-ticket-feature
 * Date: 2026-01-06
 *
 * Defines the component props and interfaces for UI components.
 */

import type { Stage } from './api-contracts';

// ============================================================================
// Close Confirmation Modal
// ============================================================================

/**
 * CloseConfirmationModal component props
 *
 * Displays confirmation dialog before closing a ticket.
 * Uses shadcn/ui AlertDialog pattern.
 */
export interface CloseConfirmationModalProps {
  /**
   * Ticket to be closed (null when modal is closed)
   */
  ticket: {
    id: number;
    ticketKey: string;
    title: string;
    branch: string | null;
  } | null;

  /**
   * Whether the modal is open
   */
  open: boolean;

  /**
   * Callback when modal open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * Callback when user confirms closure
   */
  onConfirm: () => void;

  /**
   * Whether a close operation is in progress
   */
  isClosing?: boolean;
}

// ============================================================================
// Close Zone (Droppable)
// ============================================================================

/**
 * CloseZone component props
 *
 * Droppable zone displayed when dragging from VERIFY to SHIP.
 * Part of the dual drop zone UX.
 */
export interface CloseZoneProps {
  /**
   * Whether the zone is currently being hovered
   */
  isOver: boolean;

  /**
   * Whether the zone is visible (only when dragging from VERIFY)
   */
  isVisible: boolean;
}

// ============================================================================
// Extended Stage Column
// ============================================================================

/**
 * Extended StageColumn props for dual drop zone support
 *
 * When stage is SHIP and dragSource is VERIFY, the column
 * renders two droppable zones instead of one.
 */
export interface StageColumnDualZoneProps {
  /**
   * Whether dual zones should be displayed
   * True when: stage === 'SHIP' && dragSource === 'VERIFY'
   */
  showDualZones: boolean;

  /**
   * Callback when ticket is dropped on Ship zone (top)
   */
  onShipDrop?: (ticketId: number) => void;

  /**
   * Callback when ticket is dropped on Close zone (bottom)
   */
  onCloseDrop?: (ticketId: number) => void;
}

// ============================================================================
// Search Result Item (Extended)
// ============================================================================

/**
 * TicketSearchResult component props for closed ticket display
 */
export interface TicketSearchResultProps {
  /**
   * Ticket data from search
   */
  ticket: {
    id: number;
    ticketKey: string;
    title: string;
    stage: Stage;
    closedAt?: string | null;
  };

  /**
   * Callback when result is clicked
   */
  onClick: (ticketId: number) => void;

  /**
   * Whether this result is currently selected
   */
  isSelected?: boolean;
}

// ============================================================================
// Ticket Detail Modal (Extended)
// ============================================================================

/**
 * Extended TicketDetailModal props for read-only closed ticket display
 */
export interface TicketDetailModalReadOnlyProps {
  /**
   * Whether the ticket is in read-only mode
   * True when: ticket.stage === 'CLOSED'
   */
  isReadOnly: boolean;

  /**
   * When the ticket was closed (for display)
   */
  closedAt?: string | null;
}

// ============================================================================
// Dual Zone Styling Constants
// ============================================================================

/**
 * Styling constants for dual drop zones per spec requirements
 */
export const DUAL_ZONE_STYLES = {
  ship: {
    height: '60%', // Top portion
    border: 'border-4 border-solid border-purple-500',
    background: 'bg-purple-500/10',
    label: 'Ship',
  },
  close: {
    height: '40%', // Bottom portion
    border: 'border-4 border-dashed border-red-500',
    background: 'bg-red-500/10',
    label: 'Close',
    icon: 'Archive', // lucide-react icon name
  },
} as const;

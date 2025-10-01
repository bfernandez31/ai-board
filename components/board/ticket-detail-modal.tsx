'use client';

import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

/**
 * Ticket type for modal (compatible with both Prisma Ticket and TicketWithVersion)
 */
interface TicketData {
  id: number;
  title: string;
  description: string | null;
  stage: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Props interface for TicketDetailModal component
 */
interface TicketDetailModalProps {
  /** The ticket to display in the modal. When null, modal should not render content. */
  ticket: TicketData | null;

  /** Controls the visibility of the modal dialog. */
  open: boolean;

  /** Callback fired when the modal requests to be closed (via close button, ESC, or overlay click). */
  onOpenChange: (open: boolean) => void;
}

/**
 * Stage badge configuration mapping stages to Tailwind CSS classes
 */
const stageBadgeConfig: Record<string, { label: string; className: string }> = {
  INBOX: { label: 'Inbox', className: 'bg-zinc-600 text-zinc-50 border-zinc-500' },
  PLAN: { label: 'Plan', className: 'bg-blue-600 text-blue-50 border-blue-500' },
  BUILD: { label: 'Build', className: 'bg-green-600 text-green-50 border-green-500' },
  VERIFY: { label: 'Verify', className: 'bg-orange-600 text-orange-50 border-orange-500' },
  SHIP: { label: 'Ship', className: 'bg-purple-600 text-purple-50 border-purple-500' },
};

/**
 * Helper function to format ticket dates in human-readable format
 */
const formatTicketDate = (date: Date | string | null | undefined): string => {
  if (!date) return 'Unknown date';

  try {
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
};

/**
 * TicketDetailModal Component
 *
 * Displays full ticket details in a modal dialog. The modal is responsive:
 * - Mobile (<768px): Full-screen layout
 * - Desktop (≥768px): Centered modal with max-width
 *
 * Features:
 * - Display ticket title, description, stage, and dates
 * - Close via button, ESC key, or clicking outside
 * - Keyboard accessible with focus trap
 * - Dark theme styling consistent with app
 *
 * @param ticket - The ticket object to display, or null to hide content
 * @param open - Boolean controlling modal visibility
 * @param onOpenChange - Callback for state changes (e.g., when user closes modal)
 */
export function TicketDetailModal({ ticket, open, onOpenChange }: TicketDetailModalProps) {
  // Don't render content if no ticket is selected
  if (!ticket) {
    return null;
  }

  // Get stage badge configuration
  const stageBadge = stageBadgeConfig[ticket.stage] || {
    label: ticket.stage,
    className: 'bg-zinc-600 text-zinc-50 border-zinc-500',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          h-screen w-screen p-6
          sm:h-auto sm:max-w-2xl sm:max-h-[90vh] sm:rounded-lg sm:p-8
          bg-zinc-900 border-zinc-700 text-zinc-100
        "
      >
        {/* Header with title */}
        <DialogHeader className="pb-4">
          <DialogTitle
            className="text-2xl font-bold text-zinc-100"
            data-testid="modal-title"
          >
            {ticket.title}
          </DialogTitle>
        </DialogHeader>

        {/* Modal body content */}
        <div className="space-y-6">
          {/* Stage badge */}
          <div>
            <Badge
              className={`${stageBadge.className} text-xs px-3 py-1 font-semibold`}
              data-testid="stage-badge"
            >
              {stageBadge.label}
            </Badge>
          </div>

          {/* Description section */}
          <div>
            <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-2 font-semibold">
              Description
            </h3>
            <div
              className="
                text-base text-zinc-200 leading-relaxed
                max-h-96 overflow-y-auto
                pr-2
                scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900
              "
              data-testid="ticket-description"
            >
              {ticket.description || 'No description provided'}
            </div>
          </div>

          {/* Dates section */}
          <div className="border-t border-zinc-700 pt-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Created:</span>
              <span className="text-sm text-zinc-200">
                {formatTicketDate(ticket.createdAt)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Last Updated:</span>
              <span className="text-sm text-zinc-200">
                {formatTicketDate(ticket.updatedAt)}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { Stage } from './stage-transitions';
import { TicketWithVersion } from './types';

/**
 * Optimistic Updates Utility
 *
 * Provides functions for optimistically updating ticket state in the UI
 * before server confirmation, with rollback capabilities on error.
 */

/**
 * Update a ticket's stage optimistically in local state
 * @param tickets - Current array of tickets
 * @param ticketId - ID of the ticket to update
 * @param newStage - New stage to assign
 * @returns Updated array of tickets with the specified ticket's stage changed
 */
export function updateTicketStageOptimistically(
  tickets: TicketWithVersion[],
  ticketId: number,
  newStage: Stage
): TicketWithVersion[] {
  return tickets.map((ticket) =>
    ticket.id === ticketId
      ? {
          ...ticket,
          stage: newStage,
          // Optimistically increment version (will be confirmed by server)
          version: ticket.version + 1,
        }
      : ticket
  );
}

/**
 * Revert a ticket's stage back to its original value
 * @param tickets - Current array of tickets
 * @param ticketId - ID of the ticket to revert
 * @param originalStage - Original stage to revert to
 * @param originalVersion - Original version to revert to
 * @returns Updated array of tickets with the specified ticket reverted
 */
export function revertTicketStage(
  tickets: TicketWithVersion[],
  ticketId: number,
  originalStage: Stage,
  originalVersion: number
): TicketWithVersion[] {
  return tickets.map((ticket) =>
    ticket.id === ticketId
      ? {
          ...ticket,
          stage: originalStage,
          version: originalVersion,
        }
      : ticket
  );
}

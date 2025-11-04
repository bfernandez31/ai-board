import { Ticket, Job, Stage, JobStatus } from '@prisma/client';

/**
 * Ticket type with optional jobs relation
 */
type TicketWithJobs = Ticket & {
  jobs?: Pick<Job, 'status'>[];
};

/**
 * Determines if a ticket can be deleted via drag-to-trash
 *
 * Business Rules:
 * - SHIP stage tickets cannot be deleted (permanent deployment)
 * - Tickets with active jobs (PENDING or RUNNING) cannot be deleted (concurrency protection)
 * - All other tickets can be deleted
 *
 * @param ticket - Ticket object with optional jobs relation
 * @returns true if ticket can be deleted, false otherwise
 *
 * @example
 * ```typescript
 * const ticket = { id: 1, stage: 'INBOX', jobs: [] };
 * isTicketDeletable(ticket); // true
 *
 * const shipTicket = { id: 2, stage: 'SHIP', jobs: [] };
 * isTicketDeletable(shipTicket); // false (SHIP stage)
 *
 * const busyTicket = { id: 3, stage: 'BUILD', jobs: [{ status: 'RUNNING' }] };
 * isTicketDeletable(busyTicket); // false (active job)
 * ```
 */
export function isTicketDeletable(ticket: TicketWithJobs): boolean {
  // Rule 1: SHIP stage tickets cannot be deleted
  if (ticket.stage === Stage.SHIP) {
    return false;
  }

  // Rule 2: Tickets with active jobs cannot be deleted
  const hasActiveJob = ticket.jobs?.some(
    (job) => job.status === JobStatus.PENDING || job.status === JobStatus.RUNNING
  );

  if (hasActiveJob) {
    return false;
  }

  // All other tickets can be deleted
  return true;
}

/**
 * Gets the reason why a ticket cannot be deleted (for UI tooltips)
 *
 * @param ticket - Ticket object with optional jobs relation
 * @returns Reason string if not deletable, null if deletable
 *
 * @example
 * ```typescript
 * const shipTicket = { id: 1, stage: 'SHIP', jobs: [] };
 * getDeletionBlockReason(shipTicket);
 * // "SHIP stage tickets cannot be deleted"
 * ```
 */
export function getDeletionBlockReason(ticket: TicketWithJobs): string | null {
  if (ticket.stage === Stage.SHIP) {
    return 'SHIP stage tickets cannot be deleted';
  }

  const hasActiveJob = ticket.jobs?.some(
    (job) => job.status === JobStatus.PENDING || job.status === JobStatus.RUNNING
  );

  if (hasActiveJob) {
    return 'Cannot delete ticket while job is in progress';
  }

  return null;
}

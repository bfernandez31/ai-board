import { JobStatus, Stage } from '@prisma/client';

/**
 * Ticket eligibility data for deployment validation
 */
export interface TicketEligibilityData {
  stage: Stage;
  branch: string | null;
  jobs: Array<{
    status: JobStatus;
    command: string;
    createdAt: Date;
  }>;
}

/**
 * Validates if a ticket is eligible for Vercel preview deployment
 *
 * Eligibility requirements:
 * 1. Ticket must be in VERIFY stage
 * 2. Ticket must have a valid branch (not null)
 * 3. Latest job with command='verify' must have COMPLETED status
 *
 * @param ticket - Ticket data with stage, branch, and jobs
 * @returns true if ticket can be deployed, false otherwise
 *
 * @example
 * ```typescript
 * const ticket = await prisma.ticket.findUnique({
 *   where: { id: ticketId },
 *   include: {
 *     jobs: {
 *       select: { status: true, command: true, createdAt: true },
 *       orderBy: { createdAt: 'desc' },
 *     },
 *   },
 * });
 *
 * if (isTicketDeployable(ticket)) {
 *   // Trigger deployment
 * }
 * ```
 */
export function isTicketDeployable(ticket: TicketEligibilityData): boolean {
  // Requirement 1: Must be in VERIFY stage
  if (ticket.stage !== 'VERIFY') {
    return false;
  }

  // Requirement 2: Must have a branch
  if (!ticket.branch) {
    return false;
  }

  // Requirement 3: Latest 'verify' job must be COMPLETED
  if (ticket.jobs.length === 0) {
    return false;
  }

  // Filter for verify jobs only, then sort by createdAt descending
  const verifyJobs = ticket.jobs
    .filter((job) => job.command === 'verify')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  // Must have at least one verify job
  if (verifyJobs.length === 0) {
    return false;
  }

  const latestVerifyJob = verifyJobs[0];

  return latestVerifyJob?.status === 'COMPLETED';
}

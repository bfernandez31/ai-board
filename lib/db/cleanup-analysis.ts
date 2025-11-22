import { prisma } from './client';

/**
 * Information about the last cleanup for a project
 */
export interface LastCleanupInfo {
  /** Date of the last cleanup (or epoch if first cleanup) */
  date: Date;
  /** Ticket key of the last cleanup (e.g., "AIB-123") */
  ticketKey: string | null;
  /** Branch name of the last cleanup (e.g., "cleanup-20251121") */
  branch: string | null;
  /** Whether this is the first cleanup (no previous cleanup found) */
  isFirstCleanup: boolean;
}

/**
 * Summary of changes since last cleanup
 */
export interface ChangesSummary {
  /** Number of tickets shipped since last cleanup */
  ticketsShipped: number;
  /** List of ticket keys that were shipped */
  shippedTicketKeys: string[];
  /** Date range of changes */
  dateRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Get information about the last cleanup operation for a project
 * Looks for tickets with workflowType=CLEAN that reached SHIP stage
 *
 * @param projectId - The project ID
 * @returns Information about the last cleanup
 */
export async function getLastCleanupInfo(projectId: number): Promise<LastCleanupInfo> {
  const lastCleanTicket = await prisma.ticket.findFirst({
    where: {
      projectId,
      workflowType: 'CLEAN',
      stage: 'SHIP', // Only consider completed cleanups
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      updatedAt: true,
      ticketKey: true,
      branch: true,
    },
  });

  if (!lastCleanTicket) {
    return {
      date: new Date(0), // Unix epoch if first cleanup
      ticketKey: null,
      branch: null,
      isFirstCleanup: true,
    };
  }

  return {
    date: lastCleanTicket.updatedAt,
    ticketKey: lastCleanTicket.ticketKey,
    branch: lastCleanTicket.branch,
    isFirstCleanup: false,
  };
}

/**
 * Get summary of changes since the last cleanup
 * Counts all tickets that reached SHIP stage since last cleanup
 *
 * @param projectId - The project ID
 * @param lastCleanupDate - The date of the last cleanup
 * @returns Summary of changes
 */
export async function getChangesSinceLastCleanup(
  projectId: number,
  lastCleanupDate: Date
): Promise<ChangesSummary> {
  const shippedTickets = await prisma.ticket.findMany({
    where: {
      projectId,
      stage: 'SHIP',
      workflowType: { not: 'CLEAN' }, // Exclude cleanup tickets themselves
      updatedAt: { gt: lastCleanupDate },
    },
    select: { ticketKey: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });

  const now = new Date();

  return {
    ticketsShipped: shippedTickets.length,
    shippedTicketKeys: shippedTickets.map(t => t.ticketKey),
    dateRange: {
      from: lastCleanupDate,
      to: now,
    },
  };
}

/**
 * Check if there are enough changes to warrant a cleanup
 * Returns false if no tickets have been shipped since last cleanup
 *
 * @param projectId - The project ID
 * @returns true if cleanup is warranted, false otherwise
 */
export async function shouldRunCleanup(projectId: number): Promise<{
  shouldRun: boolean;
  reason: string;
  lastCleanup: LastCleanupInfo;
  changes: ChangesSummary;
}> {
  const lastCleanup = await getLastCleanupInfo(projectId);
  const changes = await getChangesSinceLastCleanup(projectId, lastCleanup.date);

  if (changes.ticketsShipped === 0) {
    return {
      shouldRun: false,
      reason: 'No tickets shipped since last cleanup',
      lastCleanup,
      changes,
    };
  }

  return {
    shouldRun: true,
    reason: `${changes.ticketsShipped} ticket(s) shipped since last cleanup`,
    lastCleanup,
    changes,
  };
}

/**
 * Generate cleanup description for the ticket
 *
 * @param lastCleanup - Information about the last cleanup
 * @param changes - Summary of changes since last cleanup
 * @returns Formatted description for the cleanup ticket
 */
export function generateCleanupDescription(
  lastCleanup: LastCleanupInfo,
  changes: ChangesSummary
): string {
  const fromDate = lastCleanup.date.toISOString().split('T')[0];
  const toDate = changes.dateRange.to.toISOString().split('T')[0];

  let description = `## Cleanup Analysis\n\n`;
  description += `**Period**: ${fromDate} → ${toDate}\n`;
  description += `**Tickets shipped**: ${changes.ticketsShipped}\n\n`;

  if (lastCleanup.isFirstCleanup) {
    description += `> This is the first cleanup for this project.\n\n`;
  } else {
    description += `> Last cleanup: ${lastCleanup.ticketKey} (${lastCleanup.branch})\n\n`;
  }

  description += `### Scope\n\n`;
  description += `This cleanup will analyze:\n`;
  description += `- **Diff analysis**: All changes since last cleanup merge\n`;
  description += `- **Dead code**: Identify obsolete code from recent changes\n`;
  description += `- **Project impact**: Check for ripple effects across codebase\n`;
  description += `- **Spec sync**: Ensure specifications match implementation\n\n`;

  if (changes.shippedTicketKeys.length > 0) {
    description += `### Shipped Tickets\n\n`;
    changes.shippedTicketKeys.forEach(key => {
      description += `- ${key}\n`;
    });
  }

  return description;
}

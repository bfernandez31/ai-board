import { ClarificationPolicy, Ticket, Project } from '@prisma/client';

/**
 * Type for ticket with nested project data
 * Used for effective policy resolution
 */
export type TicketWithProject = Ticket & { project: Project };

/**
 * Resolve the effective clarification policy for a ticket
 * Follows hierarchical resolution: ticket → project → system default
 *
 * @param ticket - Ticket with nested project data
 * @returns Effective clarification policy (never null)
 */
export function resolveEffectivePolicy(ticket: TicketWithProject): ClarificationPolicy {
  return ticket.clarificationPolicy ?? ticket.project.clarificationPolicy;
}

/**
 * Pure function version for testing
 * Resolve effective policy without database types
 *
 * @param ticketPolicy - Ticket's clarification policy (nullable)
 * @param projectPolicy - Project's clarification policy (NOT NULL)
 * @returns Effective clarification policy
 */
export function resolveEffectivePolicyPure(
  ticketPolicy: ClarificationPolicy | null,
  projectPolicy: ClarificationPolicy
): ClarificationPolicy {
  return ticketPolicy ?? projectPolicy;
}

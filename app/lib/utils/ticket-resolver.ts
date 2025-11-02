/**
 * Ticket resolution utilities
 * Supports both numeric ID and ticketKey formats
 */

import { prisma } from '@/lib/db/client';

/**
 * Resolves a ticket identifier (ID or ticketKey) to a ticket
 *
 * @param projectId - The project ID
 * @param identifier - Either a numeric ID (e.g., "123") or ticketKey (e.g., "AIB-44")
 * @returns The ticket if found, null otherwise
 */
export async function resolveTicket(projectId: number, identifier: string) {
  // Try parsing as numeric ID first
  const numericId = parseInt(identifier, 10);

  if (!isNaN(numericId)) {
    // It's a numeric ID
    return await prisma.ticket.findFirst({
      where: {
        id: numericId,
        projectId,
      },
    });
  }

  // It's a ticketKey (format: "ABC-123")
  return await prisma.ticket.findFirst({
    where: {
      ticketKey: identifier,
      projectId,
    },
  });
}

/**
 * Resolves a ticket identifier and includes relations
 *
 * @param projectId - The project ID
 * @param identifier - Either a numeric ID or ticketKey
 * @param include - Prisma include object for relations
 * @returns The ticket with relations if found, null otherwise
 */
export async function resolveTicketWithRelations<T extends Record<string, unknown>>(
  projectId: number,
  identifier: string,
  include: T
) {
  const numericId = parseInt(identifier, 10);

  if (!isNaN(numericId)) {
    return await prisma.ticket.findFirst({
      where: {
        id: numericId,
        projectId,
      },
      include: include as any,
    });
  }

  return await prisma.ticket.findFirst({
    where: {
      ticketKey: identifier,
      projectId,
    },
    include: include as any,
  });
}

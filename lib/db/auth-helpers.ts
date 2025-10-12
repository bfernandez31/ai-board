import { requireAuth } from './users';
import { prisma } from './client';

/**
 * Verify that a project belongs to the current user
 * @throws Error if project not found or doesn't belong to user
 */
export async function verifyProjectOwnership(projectId: number): Promise<void> {
  const userId = await requireAuth();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }
}

/**
 * Verify that a ticket's project belongs to the current user
 * @throws Error if ticket/project not found or doesn't belong to user
 */
export async function verifyTicketOwnership(ticketId: number): Promise<void> {
  const userId = await requireAuth();

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      project: {
        userId,
      },
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }
}

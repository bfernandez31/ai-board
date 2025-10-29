import { requireAuth } from './users';
import { prisma } from './client';
import type { Ticket } from '@prisma/client';

/**
 * Project data returned by authorization helpers
 */
export interface AuthorizedProject {
  id: number;
  name: string;
  githubOwner: string;
  githubRepo: string;
  clarificationPolicy: string;
}

/**
 * Verify that the current user has access to a project (owner OR member)
 * @throws Error if project not found or user doesn't have access
 * @returns The project if found and user has access
 */
export async function verifyProjectAccess(projectId: number): Promise<AuthorizedProject> {
  const userId = await requireAuth();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId },                            // Owner access
        { members: { some: { userId } } }      // Member access
      ]
    },
    select: {
      id: true,
      name: true,
      githubOwner: true,
      githubRepo: true,
      clarificationPolicy: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}

/**
 * Verify that the current user has access to a ticket (via project ownership or membership)
 * @throws Error if ticket not found or user doesn't have access
 * @returns The ticket if found and user has access
 */
export async function verifyTicketAccess(ticketId: number): Promise<Ticket> {
  const userId = await requireAuth();

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      project: {
        OR: [
          { userId },                          // Owner access
          { members: { some: { userId } } }    // Member access
        ]
      }
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  return ticket;
}

/**
 * Verify that a project belongs to the current user (owner-only)
 * @deprecated Use verifyProjectAccess() unless owner-only access is required (e.g., member management, project deletion)
 * @throws Error if project not found or doesn't belong to user
 * @returns The project if found and owned by user
 */
export async function verifyProjectOwnership(projectId: number): Promise<AuthorizedProject> {
  const userId = await requireAuth();

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      userId,
    },
    select: {
      id: true,
      name: true,
      githubOwner: true,
      githubRepo: true,
      clarificationPolicy: true,
    },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  return project;
}

/**
 * Verify that a ticket's project belongs to the current user (owner-only)
 * @deprecated Use verifyTicketAccess() instead - member access is now supported
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

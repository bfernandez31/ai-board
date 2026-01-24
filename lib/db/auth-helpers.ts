import { requireAuth } from './users';
import { prisma } from './client';
import type { Ticket } from '@prisma/client';
import type { NextRequest } from 'next/server';

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
 * Supports both session auth and Bearer token (PAT) authentication.
 * @param projectId - The project ID to verify access for
 * @param request - Optional NextRequest for Bearer token extraction
 * @throws Error if project not found or user doesn't have access
 * @returns The project if found and user has access
 */
export async function verifyProjectAccess(projectId: number, request?: NextRequest): Promise<AuthorizedProject> {
  const userId = await requireAuth(request);

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
 * Supports both session auth and Bearer token (PAT) authentication.
 * @param ticketId - The ticket ID to verify access for
 * @param request - Optional NextRequest for Bearer token extraction
 * @throws Error if ticket not found or user doesn't have access
 * @returns The ticket if found and user has access
 */
export async function verifyTicketAccess(ticketId: number, request?: NextRequest): Promise<Ticket> {
  const userId = await requireAuth(request);

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
 * Supports both session auth and Bearer token (PAT) authentication.
 * @deprecated Use verifyProjectAccess() unless owner-only access is required (e.g., member management, project deletion)
 * @param projectId - The project ID to verify ownership for
 * @param request - Optional NextRequest for Bearer token extraction
 * @throws Error if project not found or doesn't belong to user
 * @returns The project if found and owned by user
 */
export async function verifyProjectOwnership(projectId: number, request?: NextRequest): Promise<AuthorizedProject> {
  const userId = await requireAuth(request);

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

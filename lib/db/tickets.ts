import { prisma } from './client';
import { Stage, getAllStages } from '../stage-validation';
import { TicketWithVersion } from '../types';
import type { CreateTicketInput } from '../validations/ticket';

/**
 * Fetch all tickets for a specific project, grouped by stage
 * Sorted by most recently updated first
 * Returns tickets with version field for optimistic concurrency control
 * @param projectId - The project ID to filter tickets by
 */
export async function getTicketsByStage(
  projectId: number
): Promise<Record<Stage, TicketWithVersion[]>> {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
    select: {
      id: true,
      title: true,
      description: true,
      stage: true,
      version: true,
      projectId: true,
      branch: true,
      autoMode: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Group tickets by stage with new stage names
  const grouped = getAllStages().reduce(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<Stage, TicketWithVersion[]>
  );

  tickets.forEach((ticket) => {
    if (ticket.stage in grouped) {
      grouped[ticket.stage as Stage].push({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        stage: ticket.stage as Stage,
        version: ticket.version,
        projectId: ticket.projectId,
        branch: ticket.branch,
        autoMode: ticket.autoMode,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      });
    }
  });

  return grouped;
}

/**
 * Create a new ticket in the INBOX stage for a specific project
 * @param projectId - The project ID to create the ticket in
 * @param input - The ticket data (title, description)
 */
export async function createTicket(
  projectId: number,
  input: CreateTicketInput
) {
  return await prisma.ticket.create({
    data: {
      title: input.title,
      description: input.description,
      stage: 'INBOX',
      projectId: projectId,
    },
  });
}

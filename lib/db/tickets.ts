import { prisma } from './client';
import { Stage, getAllStages } from '../stage-transitions';
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
      clarificationPolicy: true,
      workflowType: true,
      attachments: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          clarificationPolicy: true,
          githubOwner: true,
          githubRepo: true,
        },
      },
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
        clarificationPolicy: ticket.clarificationPolicy,
        workflowType: ticket.workflowType,
        attachments: ticket.attachments,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        project: {
          clarificationPolicy: ticket.project.clarificationPolicy,
          githubOwner: ticket.project.githubOwner,
          githubRepo: ticket.project.githubRepo,
        },
      });
    }
  });

  return grouped;
}

/**
 * Create a new ticket in the INBOX stage for a specific project
 * @param projectId - The project ID to create the ticket in
 * @param input - The ticket data (title, description, attachments)
 */
export async function createTicket(
  projectId: number,
  input: CreateTicketInput
) {
  // Build data object conditionally to satisfy exactOptionalPropertyTypes
  const baseData = {
    title: input.title,
    description: input.description,
    stage: 'INBOX' as const,
    projectId: projectId,
    updatedAt: new Date(),
  };

  // Add optional fields only if they are defined
  const dataWithOptionals = {
    ...baseData,
    ...(input.clarificationPolicy !== undefined && {
      clarificationPolicy: input.clarificationPolicy,
    }),
    ...(input.attachments !== undefined && {
      attachments: input.attachments as unknown as import('@prisma/client').Prisma.InputJsonValue,
    }),
  };

  return await prisma.ticket.create({
    data: dataWithOptionals,
  });
}

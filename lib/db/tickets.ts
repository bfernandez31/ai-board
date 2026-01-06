import { prisma } from './client';
import { Stage, getAllStages } from '../stage-transitions';
import { TicketWithVersion } from '../types';
import type { CreateTicketInput } from '../validations/ticket';
import { getNextTicketNumber } from '@/app/lib/db/ticket-sequence';
import type { Ticket } from '@prisma/client';

/**
 * Result of close ticket operation
 */
export interface CloseTicketResult {
  id: number;
  ticketKey: string;
  stage: Stage;
  closedAt: Date;
  version: number;
}

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
    where: {
      projectId,
      stage: { not: 'CLOSED' }, // Exclude CLOSED tickets from board
    },
    select: {
      id: true,
      ticketNumber: true,
      ticketKey: true,
      title: true,
      description: true,
      stage: true,
      version: true,
      projectId: true,
      branch: true,
      previewUrl: true,
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
    // No orderBy here - we'll sort per-stage after grouping
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
        ticketNumber: ticket.ticketNumber,
        ticketKey: ticket.ticketKey,
        title: ticket.title,
        description: ticket.description,
        stage: ticket.stage as Stage,
        version: ticket.version,
        projectId: ticket.projectId,
        branch: ticket.branch,
        previewUrl: ticket.previewUrl,
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

  // Sort tickets per stage: INBOX by ticketNumber ASC, others by updatedAt DESC
  getAllStages().forEach((stage) => {
    if (stage === 'INBOX') {
      // INBOX: sort by ticketNumber ascending (oldest first, newest last)
      grouped[stage].sort((a, b) => a.ticketNumber - b.ticketNumber);
    } else {
      // Other stages: sort by updatedAt descending (most recently updated first)
      grouped[stage].sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
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
  // Fetch project to get key
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { key: true },
  });

  if (!project) {
    throw new Error('Project not found');
  }

  // Generate ticket number using PostgreSQL sequence
  const ticketNumber = await getNextTicketNumber(projectId);
  const ticketKey = `${project.key}-${ticketNumber}`;

  // Build data object conditionally to satisfy exactOptionalPropertyTypes
  const baseData = {
    title: input.title,
    description: input.description,
    stage: 'INBOX' as const,
    projectId: projectId,
    ticketNumber,
    ticketKey,
    // updatedAt automatically set by Prisma (@default(now()) on createdAt, then @updatedAt on updates)
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

/**
 * Fetch all tickets for a specific project with their jobs (optimized)
 * Single query with jobs included - no N+1 problem
 * Sorted by most recently updated first
 * @param projectId - The project ID to filter tickets by
 * @returns Tickets grouped by stage with jobs included
 */
export async function getTicketsWithJobs(projectId: number) {
  const tickets = await prisma.ticket.findMany({
    where: {
      projectId,
      stage: { not: 'CLOSED' }, // Exclude CLOSED tickets from board
    },
    select: {
      id: true,
      ticketNumber: true,
      ticketKey: true,
      title: true,
      description: true,
      stage: true,
      version: true,
      projectId: true,
      branch: true,
      previewUrl: true,
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
      jobs: {
        orderBy: { startedAt: 'desc' },
      },
    },
    // No orderBy here - we'll sort per-stage after grouping
  });

  // Group tickets by stage with new stage names
  const grouped = getAllStages().reduce(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<Stage, typeof tickets>
  );

  // Transform tickets to TicketWithVersion format (with jobs for deployment eligibility)
  const groupedTickets = getAllStages().reduce(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<Stage, TicketWithVersion[]>
  );

  tickets.forEach((ticket) => {
    if (ticket.stage in groupedTickets) {
      groupedTickets[ticket.stage as Stage].push({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketKey: ticket.ticketKey,
        title: ticket.title,
        description: ticket.description,
        stage: ticket.stage as Stage,
        version: ticket.version,
        projectId: ticket.projectId,
        branch: ticket.branch,
        previewUrl: ticket.previewUrl,
        autoMode: ticket.autoMode,
        clarificationPolicy: ticket.clarificationPolicy,
        workflowType: ticket.workflowType,
        attachments: ticket.attachments,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
        project: ticket.project,
        // Add jobs for deployment eligibility check
        jobs: ticket.jobs.map((job) => ({
          status: job.status,
          command: job.command,
          createdAt: job.createdAt,
        })),
      });
      // Keep original tickets with jobs for job map
      grouped[ticket.stage as Stage].push(ticket);
    }
  });

  // Sort tickets per stage: INBOX by ticketNumber ASC, others by updatedAt DESC
  getAllStages().forEach((stage) => {
    if (stage === 'INBOX') {
      // INBOX: sort by ticketNumber ascending (oldest first, newest last)
      groupedTickets[stage].sort((a, b) => a.ticketNumber - b.ticketNumber);
      grouped[stage].sort((a, b) => a.ticketNumber - b.ticketNumber);
    } else {
      // Other stages: sort by updatedAt descending (most recently updated first)
      groupedTickets[stage].sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      grouped[stage].sort((a, b) => {
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      });
    }
  });

  return { ticketsByStage: groupedTickets, ticketsWithJobs: grouped };
}

/**
 * Duplicate a ticket within the same project
 * Creates a new ticket in INBOX stage with "Copy of " prefix and copied fields
 * @param projectId - The project ID containing the source ticket
 * @param sourceTicketId - The ID of the ticket to duplicate
 * @returns The newly created duplicate ticket
 */
export async function duplicateTicket(
  projectId: number,
  sourceTicketId: number
): Promise<Ticket> {
  // Fetch source ticket with project key for generating new ticketKey
  const sourceTicket = await prisma.ticket.findFirst({
    where: {
      id: sourceTicketId,
      projectId: projectId,
    },
    include: {
      project: {
        select: { key: true },
      },
    },
  });

  if (!sourceTicket) {
    throw new Error('Ticket not found');
  }

  // Generate new ticket number using PostgreSQL sequence
  const ticketNumber = await getNextTicketNumber(projectId);
  const ticketKey = `${sourceTicket.project.key}-${ticketNumber}`;

  // Apply "Copy of " prefix, truncating source title to 92 chars if needed
  const PREFIX = 'Copy of ';
  const maxSourceLength = 100 - PREFIX.length; // 92 chars
  const truncatedTitle =
    sourceTicket.title.length > maxSourceLength
      ? sourceTicket.title.substring(0, maxSourceLength)
      : sourceTicket.title;
  const newTitle = `${PREFIX}${truncatedTitle}`;

  // Build data object for new ticket
  const duplicateData = {
    title: newTitle,
    description: sourceTicket.description,
    stage: 'INBOX' as const,
    version: 1,
    projectId: projectId,
    ticketNumber,
    ticketKey,
    branch: null,
    previewUrl: null,
    autoMode: false,
    workflowType: 'FULL' as const,
    attachments: sourceTicket.attachments as import('@prisma/client').Prisma.InputJsonValue,
    clarificationPolicy: sourceTicket.clarificationPolicy,
  };

  return await prisma.ticket.create({
    data: duplicateData,
  });
}

/**
 * Close a ticket by transitioning it to CLOSED stage.
 * Atomic update of stage to CLOSED and set closedAt timestamp.
 * Uses optimistic concurrency control via version field.
 *
 * @param ticketId - The ID of the ticket to close
 * @param currentVersion - The current version for OCC
 * @returns The closed ticket result
 * @throws Error if ticket not found or version mismatch
 */
export async function closeTicket(
  ticketId: number,
  currentVersion: number
): Promise<CloseTicketResult> {
  const closedAt = new Date();

  const updatedTicket = await prisma.ticket.update({
    where: {
      id: ticketId,
      version: currentVersion, // OCC check
    },
    data: {
      stage: 'CLOSED',
      closedAt,
      version: { increment: 1 },
    },
    select: {
      id: true,
      ticketKey: true,
      stage: true,
      closedAt: true,
      version: true,
    },
  });

  return {
    id: updatedTicket.id,
    ticketKey: updatedTicket.ticketKey,
    stage: updatedTicket.stage as Stage,
    closedAt: updatedTicket.closedAt!,
    version: updatedTicket.version,
  };
}

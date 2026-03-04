import { prisma } from './client';
import { Stage, getAllStages } from '../stage-transitions';
import { TicketWithVersion } from '../types';
import type { CreateTicketInput } from '../validations/ticket';
import { getNextTicketNumber } from '@/app/lib/db/ticket-sequence';
import type { Ticket, Job } from '@prisma/client';

function createEmptyStageMap<T>(): Record<Stage, T[]> {
  return getAllStages().reduce(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<Stage, T[]>
  );
}

function sortByStage<T extends { ticketNumber: number; updatedAt: string | Date }>(
  grouped: Record<Stage, T[]>
): void {
  for (const stage of getAllStages()) {
    if (stage === 'INBOX') {
      grouped[stage].sort((a, b) => a.ticketNumber - b.ticketNumber);
    } else {
      grouped[stage].sort((a, b) => {
        const timeA = typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : a.updatedAt.getTime();
        const timeB = typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : b.updatedAt.getTime();
        return timeB - timeA;
      });
    }
  }
}

/**
 * Fetch all tickets for a project, grouped by stage with optimistic concurrency version
 */
export async function getTicketsByStage(
  projectId: number
): Promise<Record<Stage, TicketWithVersion[]>> {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
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
      agent: true,
      workflowType: true,
      attachments: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          clarificationPolicy: true,
          defaultAgent: true,
          githubOwner: true,
          githubRepo: true,
        },
      },
    },
    // No orderBy here - we'll sort per-stage after grouping
  });

  const grouped = createEmptyStageMap<TicketWithVersion>();

  for (const ticket of tickets) {
    const stage = ticket.stage as Stage;
    if (!(stage in grouped)) continue;

    grouped[stage].push({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketKey: ticket.ticketKey,
      title: ticket.title,
      description: ticket.description,
      stage,
      version: ticket.version,
      projectId: ticket.projectId,
      branch: ticket.branch,
      previewUrl: ticket.previewUrl,
      autoMode: ticket.autoMode,
      clarificationPolicy: ticket.clarificationPolicy,
      agent: ticket.agent,
      workflowType: ticket.workflowType,
      attachments: ticket.attachments,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      project: ticket.project,
    });
  }

  sortByStage(grouped);

  return grouped;
}

/**
 * Create a new ticket in INBOX stage
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
    ...(input.agent !== undefined && {
      agent: input.agent,
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
 * Fetch all tickets for a project with jobs included (single query, no N+1)
 */
export async function getTicketsWithJobs(projectId: number) {
  const tickets = await prisma.ticket.findMany({
    where: { projectId },
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
      agent: true,
      workflowType: true,
      attachments: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          clarificationPolicy: true,
          defaultAgent: true,
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

  const rawByStage = createEmptyStageMap<(typeof tickets)[number]>();
  const ticketsByStage = createEmptyStageMap<TicketWithVersion>();

  for (const ticket of tickets) {
    const stage = ticket.stage as Stage;
    if (!(stage in ticketsByStage)) continue;

    ticketsByStage[stage].push({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      ticketKey: ticket.ticketKey,
      title: ticket.title,
      description: ticket.description,
      stage,
      version: ticket.version,
      projectId: ticket.projectId,
      branch: ticket.branch,
      previewUrl: ticket.previewUrl,
      autoMode: ticket.autoMode,
      clarificationPolicy: ticket.clarificationPolicy,
      agent: ticket.agent,
      workflowType: ticket.workflowType,
      attachments: ticket.attachments,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      project: ticket.project,
      jobs: ticket.jobs.map((job) => ({
        status: job.status,
        command: job.command,
        createdAt: job.createdAt,
      })),
    });
    rawByStage[stage].push(ticket);
  }

  sortByStage(ticketsByStage);
  sortByStage(rawByStage);

  return { ticketsByStage, ticketsWithJobs: rawByStage };
}

/**
 * Duplicate a ticket in INBOX with "Copy of " prefix
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
    agent: sourceTicket.agent,
  };

  return await prisma.ticket.create({
    data: duplicateData,
  });
}

/**
 * Full clone a ticket preserving stage, jobs, and telemetry
 */
export async function fullCloneTicket(
  projectId: number,
  sourceTicketId: number,
  newBranch: string,
  ticketNumber: number
): Promise<Ticket & { jobs: Job[] }> {
  // Fetch source ticket with jobs and project key for generating new ticketKey
  const sourceTicket = await prisma.ticket.findFirst({
    where: {
      id: sourceTicketId,
      projectId: projectId,
    },
    include: {
      project: {
        select: { key: true },
      },
      jobs: true,
    },
  });

  if (!sourceTicket) {
    throw new Error('Ticket not found');
  }

  // Use pre-generated ticket number to construct ticketKey
  const ticketKey = `${sourceTicket.project.key}-${ticketNumber}`;

  // Apply "Clone of " prefix, truncating source title to 91 chars if needed
  const PREFIX = 'Clone of ';
  const maxSourceLength = 100 - PREFIX.length; // 91 chars
  const truncatedTitle =
    sourceTicket.title.length > maxSourceLength
      ? sourceTicket.title.substring(0, maxSourceLength)
      : sourceTicket.title;
  const newTitle = `${PREFIX}${truncatedTitle}`;

  // Use transaction to ensure atomic creation of ticket + jobs
  const result = await prisma.$transaction(async (tx) => {
    // Create the cloned ticket with preserved stage
    const newTicket = await tx.ticket.create({
      data: {
        title: newTitle,
        description: sourceTicket.description,
        stage: sourceTicket.stage, // Preserve stage
        version: 1,
        projectId: projectId,
        ticketNumber,
        ticketKey,
        branch: newBranch, // New branch created from source
        previewUrl: null, // Reset preview URL
        autoMode: sourceTicket.autoMode,
        workflowType: sourceTicket.workflowType, // Preserve workflow type
        attachments: sourceTicket.attachments as import('@prisma/client').Prisma.InputJsonValue,
        clarificationPolicy: sourceTicket.clarificationPolicy,
        agent: sourceTicket.agent,
      },
    });

    // Copy all jobs with telemetry data
    if (sourceTicket.jobs.length > 0) {
      await tx.job.createMany({
        data: sourceTicket.jobs.map((job) => ({
          ticketId: newTicket.id, // Reference new ticket
          projectId: job.projectId,
          command: job.command,
          status: job.status, // Point-in-time snapshot
          branch: newBranch, // Updated to new branch
          commitSha: job.commitSha,
          logs: job.logs,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          updatedAt: job.updatedAt, // Copy original updatedAt timestamp
          // Telemetry data
          inputTokens: job.inputTokens,
          outputTokens: job.outputTokens,
          cacheReadTokens: job.cacheReadTokens,
          cacheCreationTokens: job.cacheCreationTokens,
          costUsd: job.costUsd,
          durationMs: job.durationMs,
          model: job.model,
          toolsUsed: job.toolsUsed,
        })),
      });
    }

    // Fetch the created ticket with jobs to return
    const ticketWithJobs = await tx.ticket.findUnique({
      where: { id: newTicket.id },
      include: { jobs: true },
    });

    if (!ticketWithJobs) {
      throw new Error('Failed to retrieve cloned ticket');
    }

    return ticketWithJobs;
  });

  return result;
}

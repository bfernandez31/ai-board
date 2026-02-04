import { prisma } from './client';
import { Stage, getAllStages } from '../stage-transitions';
import { TicketWithVersion } from '../types';
import type { CreateTicketInput } from '../validations/ticket';
import { getNextTicketNumber } from '@/app/lib/db/ticket-sequence';
import type { Ticket } from '@prisma/client';
import { createGitHubClient } from '@/app/lib/github/client';

/**
 * Creates a prefixed title for duplicated/cloned tickets
 * Truncates source title if needed to stay within 100 character limit
 */
function createPrefixedTitle(sourceTitle: string, prefix: string): string {
  const maxSourceLength = 100 - prefix.length;
  const truncatedTitle = sourceTitle.length > maxSourceLength
    ? sourceTitle.substring(0, maxSourceLength)
    : sourceTitle;
  return `${prefix}${truncatedTitle}`;
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

  const newTitle = createPrefixedTitle(sourceTicket.title, 'Copy of ');

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
 * Stages that are eligible for full clone operation
 */
const CLONEABLE_STAGES = ['SPECIFY', 'PLAN', 'BUILD', 'VERIFY'] as const;

/**
 * Full clone a ticket with all jobs and a new Git branch
 *
 * Creates a complete copy including:
 * - All ticket data (title with "Clone of " prefix, description, attachments, stage, workflowType)
 * - All jobs with complete telemetry data
 * - A new Git branch created from the source branch
 *
 * @param projectId - The project ID containing the source ticket
 * @param sourceTicketId - The ID of the ticket to clone
 * @returns The newly created cloned ticket
 * @throws Error if ticket not in cloneable stage, has no branch, or GitHub operation fails
 */
export async function fullCloneTicket(
  projectId: number,
  sourceTicketId: number
): Promise<Ticket> {
  // Fetch source ticket with project and jobs data
  const sourceTicket = await prisma.ticket.findFirst({
    where: {
      id: sourceTicketId,
      projectId: projectId,
    },
    include: {
      project: {
        select: {
          key: true,
          githubOwner: true,
          githubRepo: true,
        },
      },
      jobs: {
        orderBy: { startedAt: 'asc' },
      },
    },
  });

  if (!sourceTicket) {
    throw new Error('Ticket not found');
  }

  // Validate stage is eligible for full clone
  if (!CLONEABLE_STAGES.includes(sourceTicket.stage as typeof CLONEABLE_STAGES[number])) {
    throw new Error('Full clone is only available for tickets in SPECIFY, PLAN, BUILD, or VERIFY stages');
  }

  // Validate source ticket has a branch
  if (!sourceTicket.branch) {
    throw new Error('Source ticket has no branch to clone');
  }

  // Generate new ticket number and key
  const ticketNumber = await getNextTicketNumber(projectId);
  const ticketKey = `${sourceTicket.project.key}-${ticketNumber}`;

  // Generate new branch name by replacing ticket key in source branch
  // Source: "AIB-123-fix-login" -> Target: "AIB-124-fix-login"
  const branchSlug = sourceTicket.branch.replace(/^[A-Z]+-\d+-/, '');
  const newBranch = `${ticketKey}-${branchSlug}`;

  // Create Git branch from source branch
  const owner = sourceTicket.project.githubOwner;
  const repo = sourceTicket.project.githubRepo;

  if (!owner || !repo) {
    throw new Error('Project is not linked to a GitHub repository');
  }

  const octokit = createGitHubClient();

  // Get the SHA of the source branch
  let sourceSha: string;
  try {
    const { data: refData } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${sourceTicket.branch}`,
    });
    sourceSha = refData.object.sha;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create branch: Could not find source branch ${sourceTicket.branch}. ${errorMessage}`);
  }

  // Create new branch from source SHA
  try {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${newBranch}`,
      sha: sourceSha,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create branch ${newBranch}: ${errorMessage}`);
  }

  const newTitle = createPrefixedTitle(sourceTicket.title, 'Clone of ');

  // Create the cloned ticket and jobs in a transaction
  const newTicket = await prisma.$transaction(async (tx) => {
    // Create the ticket with same stage and workflowType
    const clonedTicket = await tx.ticket.create({
      data: {
        title: newTitle,
        description: sourceTicket.description,
        stage: sourceTicket.stage,
        version: 1,
        projectId: projectId,
        ticketNumber,
        ticketKey,
        branch: newBranch,
        previewUrl: null, // Preview URL is not cloned
        autoMode: sourceTicket.autoMode,
        workflowType: sourceTicket.workflowType,
        attachments: sourceTicket.attachments as import('@prisma/client').Prisma.InputJsonValue,
        clarificationPolicy: sourceTicket.clarificationPolicy,
      },
    });

    // Clone all jobs from source ticket
    if (sourceTicket.jobs.length > 0) {
      await tx.job.createMany({
        data: sourceTicket.jobs.map((job) => ({
          ticketId: clonedTicket.id,
          projectId: projectId,
          command: job.command,
          status: job.status,
          branch: newBranch, // Use new branch
          commitSha: job.commitSha,
          logs: job.logs,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          updatedAt: job.updatedAt,
          // Telemetry fields
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

    return clonedTicket;
  });

  return newTicket;
}

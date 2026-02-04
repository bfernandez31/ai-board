import { prisma } from './client';
import { Stage, getAllStages } from '../stage-transitions';
import { TicketWithVersion } from '../types';
import type { CreateTicketInput } from '../validations/ticket';
import { FULL_CLONE_ELIGIBLE_STAGES } from '../validations/ticket';
import { getNextTicketNumber } from '@/app/lib/db/ticket-sequence';
import type { Ticket } from '@prisma/client';
import { createBranchFrom, BranchNotFoundError, GitHubPermissionError } from '../github/create-branch-from';
import { Octokit } from '@octokit/rest';

/**
 * Error thrown when full clone eligibility validation fails
 */
export class FullCloneValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FullCloneValidationError';
  }
}

/**
 * Re-export GitHub errors for API error handling
 */
export { BranchNotFoundError, GitHubPermissionError };

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
 * Checks if a ticket is eligible for full clone operation
 * @param stage - The ticket's current stage
 * @param branch - The ticket's branch (can be null)
 * @returns true if eligible, throws FullCloneValidationError if not
 */
export function validateFullCloneEligibility(
  stage: string,
  branch: string | null
): void {
  // Check stage eligibility
  if (!FULL_CLONE_ELIGIBLE_STAGES.includes(stage as typeof FULL_CLONE_ELIGIBLE_STAGES[number])) {
    throw new FullCloneValidationError(
      `Full clone not available for tickets in ${stage} stage. Only tickets in SPECIFY, PLAN, BUILD, or VERIFY stages can be fully cloned.`
    );
  }

  // Check branch exists
  if (!branch) {
    throw new FullCloneValidationError(
      'Source ticket has no branch to clone. Full clone requires a branch.'
    );
  }
}

/**
 * Generate a branch name for a cloned ticket
 * Follows the pattern: {ticketNumber}-{slugified-title}
 */
function generateBranchName(ticketNumber: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  return `${ticketNumber}-${slug}`;
}

/**
 * Full clone result type including jobs count
 */
export interface FullCloneResult extends Ticket {
  jobsCloned: number;
}

/**
 * Full clone a ticket within the same project
 * Creates a new ticket preserving stage, creating a new branch from source,
 * and copying all job records with telemetry data.
 *
 * @param projectId - The project ID containing the source ticket
 * @param sourceTicketId - The ID of the ticket to clone
 * @param githubToken - GitHub token for branch creation
 * @returns The newly created ticket with jobsCloned count
 * @throws FullCloneValidationError if ticket is not eligible
 * @throws BranchNotFoundError if source branch doesn't exist in GitHub
 * @throws GitHubPermissionError if GitHub token lacks permissions
 */
export async function fullCloneTicket(
  projectId: number,
  sourceTicketId: number,
  githubToken: string
): Promise<FullCloneResult> {
  // Fetch source ticket with project and jobs
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
      jobs: true,
    },
  });

  if (!sourceTicket) {
    throw new Error('Ticket not found');
  }

  // Validate eligibility
  validateFullCloneEligibility(sourceTicket.stage, sourceTicket.branch);

  // Generate new ticket number and key
  const ticketNumber = await getNextTicketNumber(projectId);
  const ticketKey = `${sourceTicket.project.key}-${ticketNumber}`;

  // Apply "Clone of " prefix, truncating source title to 91 chars if needed
  const PREFIX = 'Clone of ';
  const maxSourceLength = 100 - PREFIX.length; // 91 chars
  const truncatedTitle =
    sourceTicket.title.length > maxSourceLength
      ? sourceTicket.title.substring(0, maxSourceLength)
      : sourceTicket.title;
  const newTitle = `${PREFIX}${truncatedTitle}`;

  // Generate new branch name
  const newBranchName = generateBranchName(ticketNumber, newTitle);

  // Create GitHub branch from source branch
  const octokit = new Octokit({ auth: githubToken });
  await createBranchFrom(
    octokit,
    sourceTicket.project.githubOwner,
    sourceTicket.project.githubRepo,
    sourceTicket.branch!, // Already validated non-null
    newBranchName
  );

  // Use transaction to create ticket and copy jobs atomically
  const result = await prisma.$transaction(async (tx) => {
    // Create new ticket preserving stage
    const newTicket = await tx.ticket.create({
      data: {
        title: newTitle,
        description: sourceTicket.description,
        stage: sourceTicket.stage as 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP' | 'CLOSED',
        version: 1,
        projectId: projectId,
        ticketNumber,
        ticketKey,
        branch: newBranchName,
        previewUrl: null, // New deployment needed
        autoMode: false,
        workflowType: sourceTicket.workflowType,
        attachments: sourceTicket.attachments as import('@prisma/client').Prisma.InputJsonValue,
        clarificationPolicy: sourceTicket.clarificationPolicy,
      },
    });

    // Copy all jobs with telemetry data
    if (sourceTicket.jobs.length > 0) {
      const jobCopies = sourceTicket.jobs.map((job) => ({
        ticketId: newTicket.id,
        projectId: projectId,
        command: job.command,
        status: job.status,
        branch: newBranchName, // Update to new branch name
        commitSha: job.commitSha,
        logs: job.logs,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        updatedAt: new Date(), // Required field
        // Telemetry fields
        inputTokens: job.inputTokens,
        outputTokens: job.outputTokens,
        cacheReadTokens: job.cacheReadTokens,
        cacheCreationTokens: job.cacheCreationTokens,
        costUsd: job.costUsd,
        durationMs: job.durationMs,
        model: job.model,
        toolsUsed: job.toolsUsed,
      }));

      await tx.job.createMany({
        data: jobCopies,
      });
    }

    return newTicket;
  });

  return {
    ...result,
    jobsCloned: sourceTicket.jobs.length,
  };
}

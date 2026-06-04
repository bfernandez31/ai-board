import { z } from 'zod';
import { prisma } from './client';
import { Stage, getAllStages } from '../stage-transitions';
import { TicketWithVersion } from '../types';
import type { CreateTicketInput } from '../validations/ticket';
import { getNextTicketNumber } from '@/app/lib/db/ticket-sequence';
import { canEditDescriptionAndPolicy } from '@/lib/utils/field-edit-permissions';
import type { Ticket, Job, Prisma, ClarificationPolicy, Agent } from '@prisma/client';

type TicketRow = {
  id: number;
  ticketNumber: number;
  ticketKey: string;
  title: string;
  description: string | null;
  stage: string;
  version: number;
  projectId: number;
  branch: string | null;
  previewUrl: string | null;
  autoMode: boolean;
  clarificationPolicy: import('@prisma/client').ClarificationPolicy | null;
  agent: import('@prisma/client').Agent | null;
  specifyModel: string | null;
  planModel: string | null;
  implementModel: string | null;
  quickImplModel: string | null;
  verifyModel: string | null;
  codexSpecifyModel: string | null;
  codexPlanModel: string | null;
  codexImplementModel: string | null;
  codexQuickImplModel: string | null;
  codexVerifyModel: string | null;
  workflowType: import('@prisma/client').WorkflowType;
  attachments: import('@prisma/client').Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  project: {
    clarificationPolicy: import('@prisma/client').ClarificationPolicy;
    defaultAgent: import('@prisma/client').Agent;
    githubOwner: string | null;
    githubRepo: string | null;
  };
};

function toTicketWithVersion(ticket: TicketRow): TicketWithVersion {
  return {
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
    agent: ticket.agent,
    specifyModel: ticket.specifyModel,
    planModel: ticket.planModel,
    implementModel: ticket.implementModel,
    quickImplModel: ticket.quickImplModel,
    verifyModel: ticket.verifyModel,
    codexSpecifyModel: ticket.codexSpecifyModel,
    codexPlanModel: ticket.codexPlanModel,
    codexImplementModel: ticket.codexImplementModel,
    codexQuickImplModel: ticket.codexQuickImplModel,
    codexVerifyModel: ticket.codexVerifyModel,
    workflowType: ticket.workflowType,
    attachments: ticket.attachments,
    qualityScore: null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    project: {
      clarificationPolicy: ticket.project.clarificationPolicy,
      ...(ticket.project.defaultAgent != null && { defaultAgent: ticket.project.defaultAgent }),
      ...(ticket.project.githubOwner != null && { githubOwner: ticket.project.githubOwner }),
      ...(ticket.project.githubRepo != null && { githubRepo: ticket.project.githubRepo }),
    },
  };
}

/**
 * Fetch the latest COMPLETED verify qualityScore for each given ticket and
 * mutate `qualityScore` in place. Single batched query keyed on ticketId.
 */
async function attachQualityScores(
  tickets: TicketWithVersion[],
  projectId: number
): Promise<void> {
  if (tickets.length === 0) return;

  const verifyJobs = await prisma.job.findMany({
    where: {
      projectId,
      ticketId: { in: tickets.map((t) => t.id) },
      command: 'verify',
      status: 'COMPLETED',
      qualityScore: { not: null },
    },
    select: { ticketId: true, qualityScore: true },
    orderBy: { startedAt: 'desc' },
  });

  const scoreByTicket = new Map<number, number>();
  for (const job of verifyJobs) {
    if (
      job.qualityScore != null &&
      job.ticketId !== null &&
      !scoreByTicket.has(job.ticketId)
    ) {
      scoreByTicket.set(job.ticketId, job.qualityScore);
    }
  }

  for (const ticket of tickets) {
    ticket.qualityScore = scoreByTicket.get(ticket.id) ?? null;
  }
}

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

/** Shared select fields for ticket queries */
const TICKET_SELECT = {
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
  specifyModel: true,
  planModel: true,
  implementModel: true,
  quickImplModel: true,
  verifyModel: true,
  codexSpecifyModel: true,
  codexPlanModel: true,
  codexImplementModel: true,
  codexQuickImplModel: true,
  codexVerifyModel: true,
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
} as const;

export interface TicketsByStageResult {
  ticketsByStage: Record<Stage, TicketWithVersion[]>;
  shipTotal: number;
}

/**
 * Fetch tickets for a project, grouped by stage.
 * SHIP stage is paginated: only the first `shipLimit` tickets are returned.
 * Use `getMoreShipTickets()` to load additional SHIP tickets.
 */
export async function getTicketsByStage(
  projectId: number,
  shipLimit: number = 50
): Promise<TicketsByStageResult> {
  // Fetch non-SHIP/non-CLOSED tickets + limited SHIP tickets in parallel.
  // CLOSED tickets are excluded — they are not displayed on the board.
  const [nonShipTickets, shipTickets, shipTotal] = await Promise.all([
    prisma.ticket.findMany({
      where: { projectId, stage: { notIn: ['SHIP', 'CLOSED'] } },
      select: TICKET_SELECT,
    }),
    prisma.ticket.findMany({
      where: { projectId, stage: 'SHIP' },
      select: TICKET_SELECT,
      orderBy: { updatedAt: 'desc' },
      take: shipLimit,
    }),
    prisma.ticket.count({
      where: { projectId, stage: 'SHIP' },
    }),
  ]);

  const grouped = createEmptyStageMap<TicketWithVersion>();
  const allMapped: TicketWithVersion[] = [];

  for (const ticket of nonShipTickets) {
    const stage = ticket.stage as Stage;
    if (!(stage in grouped)) continue;
    const mapped = toTicketWithVersion(ticket);
    grouped[stage].push(mapped);
    allMapped.push(mapped);
  }

  for (const ticket of shipTickets) {
    const mapped = toTicketWithVersion(ticket);
    grouped[Stage.SHIP].push(mapped);
    allMapped.push(mapped);
  }

  await attachQualityScores(allMapped, projectId);

  sortByStage(grouped);

  return { ticketsByStage: grouped, shipTotal };
}

/**
 * Load additional SHIP tickets for pagination (offset-based).
 */
export async function getMoreShipTickets(
  projectId: number,
  offset: number,
  limit: number = 50
): Promise<TicketWithVersion[]> {
  const tickets = await prisma.ticket.findMany({
    where: { projectId, stage: 'SHIP' },
    select: TICKET_SELECT,
    orderBy: { updatedAt: 'desc' },
    skip: offset,
    take: limit,
  });

  const mapped = tickets.map(toTicketWithVersion);
  await attachQualityScores(mapped, projectId);
  return mapped;
}

/**
 * Filters for the direct ticket list query (GET /api/projects/:projectId/tickets).
 */
export interface TicketListFilters {
  stage?: 'INBOX' | 'SPECIFY' | 'PLAN' | 'BUILD' | 'VERIFY' | 'SHIP' | 'CLOSED';
  workflowType?: 'FULL' | 'QUICK' | 'CLEAN';
  limit?: number;
  updatedSince?: Date;
}

/**
 * Query tickets with arbitrary filters, ordered by updatedAt desc.
 */
export async function listTicketsFiltered(
  projectId: number,
  filters: TicketListFilters
): Promise<Ticket[]> {
  const where: Prisma.TicketWhereInput = {
    projectId,
    ...(filters.stage && { stage: filters.stage }),
    ...(filters.workflowType && { workflowType: filters.workflowType }),
    ...(filters.updatedSince && { updatedAt: { gte: filters.updatedSince } }),
  };

  return prisma.ticket.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    ...(filters.limit && { take: filters.limit }),
  });
}

/**
 * Count tickets created by a user in the current month (for plan-limit checks).
 */
export async function countTicketsThisMonthForUser(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  return prisma.ticket.count({
    where: {
      project: { userId },
      createdAt: { gte: startOfMonth },
    },
  });
}

/**
 * Returns true when a project with the given id exists.
 */
export async function projectExists(projectId: number): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  return project !== null;
}

/** Project select used by the GET /tickets/:id view. */
const VIEW_PROJECT_SELECT = {
  id: true,
  name: true,
  clarificationPolicy: true,
  defaultAgent: true,
  tokenSaving: true,
  githubOwner: true,
  githubRepo: true,
} as const;

/**
 * Find a ticket by numeric id or ticketKey within a project, including
 * the project fields required by the ticket detail view and the most
 * recent COMPLETED verify qualityScore (filtered subquery, take 1).
 */
export async function findTicketForView(
  projectId: number,
  idOrKey: string
) {
  const include = {
    project: { select: VIEW_PROJECT_SELECT },
    jobs: {
      where: {
        command: 'verify',
        status: 'COMPLETED' as const,
        qualityScore: { not: null },
      },
      orderBy: { startedAt: 'desc' as const },
      take: 1,
      select: { qualityScore: true },
    },
  } as const;

  const isNumeric = /^\d+$/.test(idOrKey);
  if (isNumeric) {
    return prisma.ticket.findFirst({
      where: { id: parseInt(idOrKey, 10), projectId },
      include,
    });
  }
  return prisma.ticket.findFirst({
    where: { ticketKey: idOrKey, projectId },
    include,
  });
}

/** Resolve a ticketKey to a numeric id within a project (or null when missing). */
export async function resolveTicketIdByKey(
  projectId: number,
  ticketKey: string
): Promise<number | null> {
  const ticket = await prisma.ticket.findFirst({
    where: { ticketKey, projectId },
    select: { id: true },
  });
  return ticket?.id ?? null;
}

/** Inline edit patch payload accepted by patchTicketInline. */
export interface TicketInlinePatch {
  title?: string;
  description?: string;
  branch?: string | null;
  autoMode?: boolean;
  clarificationPolicy?: ClarificationPolicy | null;
  agent?: Agent | null;
}

/** Discriminated result for inline PATCH. */
export type PatchTicketInlineResult =
  | { ok: true; ticket: Ticket }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Apply an inline edit to a ticket with version-conflict handling.
 *
 * Enforces:
 *  - Ticket must exist within the project (404 / 403 otherwise)
 *  - Optimistic concurrency via `version` (409 on mismatch)
 *  - description/clarificationPolicy/agent only editable in INBOX stage
 */
export async function patchTicketInline(
  ticketId: number,
  projectId: number,
  requestVersion: number,
  patch: TicketInlinePatch
): Promise<PatchTicketInlineResult> {
  const currentTicket = await prisma.ticket.findFirst({
    where: { id: ticketId, projectId },
  });

  if (!currentTicket) {
    const ticketExists = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, projectId: true },
    });
    if (!ticketExists) {
      return { ok: false, status: 404, body: { error: 'Ticket not found' } };
    }
    return { ok: false, status: 403, body: { error: 'Forbidden' } };
  }

  if (currentTicket.version !== requestVersion) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Conflict: Ticket was modified by another user',
        currentVersion: currentTicket.version,
      },
    };
  }

  const { title, description, branch, autoMode, clarificationPolicy, agent } = patch;

  if (
    (description !== undefined || clarificationPolicy !== undefined || agent !== undefined) &&
    !canEditDescriptionAndPolicy(currentTicket.stage)
  ) {
    return {
      ok: false,
      status: 400,
      body: {
        error:
          'Description, clarification policy, and agent can only be updated in INBOX stage',
        code: 'INVALID_STAGE_FOR_EDIT',
      },
    };
  }

  try {
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId, version: requestVersion },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(branch !== undefined && { branch }),
        ...(autoMode !== undefined && { autoMode }),
        ...(clarificationPolicy !== undefined && { clarificationPolicy }),
        ...(agent !== undefined && { agent }),
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    return { ok: true, ticket: updatedTicket };
  } catch (updateError) {
    if (
      updateError instanceof Error &&
      'code' in updateError &&
      (updateError as { code: string }).code === 'P2025'
    ) {
      const latestTicket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      return {
        ok: false,
        status: 409,
        body: {
          error: 'Conflict: Ticket was modified by another user',
          currentVersion: latestTicket?.version || 0,
        },
      };
    }
    throw updateError;
  }
}

/**
 * Token-saving override (AIB-849).
 * `tokenSaving`: true = Force ON, false = Force OFF, null = Inherit (clear override).
 * `version`: optimistic concurrency, mirrors the ticket PATCH.
 */
export const tokenSavingOverrideSchema = z.object({
  tokenSaving: z.boolean().nullable(),
  version: z.number().int(),
});

export type TokenSavingOverrideInput = z.infer<typeof tokenSavingOverrideSchema>;

/** Discriminated result for the token-saving override helper. */
export type PatchTicketTokenSavingResult =
  | { ok: true; ticket: { tokenSaving: boolean | null; version: number } }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Update a ticket's token-saving override (AIB-849).
 *
 * Unlike agent/policy edits, this is NOT gated by the INBOX stage — it is
 * editable at any stage (FR-013). It is instead rejected while a run is active
 * (a RUNNING or PENDING job on the ticket) so an in-flight run is never mutated.
 * Optimistic concurrency via `version`.
 */
export async function patchTicketTokenSaving(
  ticketId: number,
  projectId: number,
  requestVersion: number,
  tokenSaving: boolean | null
): Promise<PatchTicketTokenSavingResult> {
  const currentTicket = await prisma.ticket.findFirst({
    where: { id: ticketId, projectId },
    select: { id: true, version: true },
  });

  if (!currentTicket) {
    const ticketExists = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!ticketExists) {
      return { ok: false, status: 404, body: { error: 'Ticket not found' } };
    }
    return { ok: false, status: 403, body: { error: 'Forbidden' } };
  }

  if (currentTicket.version !== requestVersion) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Conflict: Ticket was modified by another user',
        code: 'VERSION_CONFLICT',
        currentVersion: currentTicket.version,
      },
    };
  }

  // Active-run guard (FR-013): no edits while a run is in progress.
  const activeJob = await prisma.job.findFirst({
    where: { ticketId, status: { in: ['RUNNING', 'PENDING'] } },
    select: { id: true },
  });
  if (activeJob) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Cannot change token saving while a run is in progress',
        code: 'ACTIVE_RUN',
      },
    };
  }

  try {
    const updated = await prisma.ticket.update({
      where: { id: ticketId, version: requestVersion },
      data: {
        tokenSaving,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
      select: { tokenSaving: true, version: true },
    });
    return { ok: true, ticket: updated };
  } catch (updateError) {
    if (
      updateError instanceof Error &&
      'code' in updateError &&
      (updateError as { code: string }).code === 'P2025'
    ) {
      const latestTicket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        select: { version: true },
      });
      return {
        ok: false,
        status: 409,
        body: {
          error: 'Conflict: Ticket was modified by another user',
          code: 'VERSION_CONFLICT',
          currentVersion: latestTicket?.version ?? 0,
        },
      };
    }
    throw updateError;
  }
}

/**
 * Create a new ticket in INBOX stage
 */
export async function createTicket(
  projectId: number,
  input: CreateTicketInput,
  options: { creatorId?: string | null } = {}
) {
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
    ...(options.creatorId != null && { creatorId: options.creatorId }),
  };

  return await prisma.ticket.create({
    data: dataWithOptionals,
  });
}

/**
 * Fetch tickets for a project with jobs included (single query, no N+1).
 * SHIP stage is paginated: only the first `shipLimit` tickets are returned.
 */
export async function getTicketsWithJobs(projectId: number, shipLimit: number = 50) {
  // Include log relation so the SSR-seeded React Query cache for `ticketJobs`
  // has the same shape as the API (`GET /api/projects/:id/tickets/:id/jobs`),
  // which selects `log: { captureStatus, preview }`. Without this, the Stats
  // tab's inline log preview never renders because the cached jobs lack `log`.
  const jobsInclude = {
    jobs: {
      orderBy: { startedAt: 'desc' as const },
      include: { log: { select: { captureStatus: true, preview: true } } },
    },
  };

  const [nonShipTickets, shipTickets, shipTotal] = await Promise.all([
    prisma.ticket.findMany({
      where: { projectId, stage: { notIn: ['SHIP', 'CLOSED'] } },
      select: { ...TICKET_SELECT, ...jobsInclude },
    }),
    prisma.ticket.findMany({
      where: { projectId, stage: 'SHIP' },
      select: { ...TICKET_SELECT, ...jobsInclude },
      orderBy: { updatedAt: 'desc' },
      take: shipLimit,
    }),
    prisma.ticket.count({
      where: { projectId, stage: 'SHIP' },
    }),
  ]);

  const allTickets = [...nonShipTickets, ...shipTickets];

  const rawByStage = createEmptyStageMap<(typeof allTickets)[number]>();
  const ticketsByStage = createEmptyStageMap<TicketWithVersion>();

  for (const ticket of allTickets) {
    const stage = ticket.stage as Stage;
    if (!(stage in ticketsByStage)) continue;

    const mapped = toTicketWithVersion(ticket);
    mapped.jobs = ticket.jobs.map((job) => ({
      status: job.status,
      command: job.command,
      createdAt: job.createdAt,
    }));
    mapped.qualityScore = latestVerifyQualityScore(ticket.jobs);
    ticketsByStage[stage].push(mapped);
    rawByStage[stage].push(ticket);
  }

  sortByStage(ticketsByStage);
  sortByStage(rawByStage);

  return { ticketsByStage, ticketsWithJobs: rawByStage, shipTotal };
}

/**
 * Pick the qualityScore of the most recent COMPLETED verify job from a list.
 * Used by `getTicketsWithJobs` (SSR) which already loaded all jobs.
 */
function latestVerifyQualityScore(
  jobs: Array<Pick<Job, 'command' | 'status' | 'qualityScore' | 'startedAt'>>
): number | null {
  let latest: { startedAt: Date; qualityScore: number } | null = null;
  for (const job of jobs) {
    if (job.command !== 'verify' || job.status !== 'COMPLETED' || job.qualityScore == null) {
      continue;
    }
    if (!latest || job.startedAt.getTime() > latest.startedAt.getTime()) {
      latest = { startedAt: job.startedAt, qualityScore: job.qualityScore };
    }
  }
  return latest?.qualityScore ?? null;
}

/**
 * Duplicate a ticket in INBOX with "Copy of " prefix
 */
export async function duplicateTicket(
  projectId: number,
  sourceTicketId: number,
  options: { creatorId?: string | null } = {}
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
    tokenSaving: sourceTicket.tokenSaving,
    ...(options.creatorId != null && { creatorId: options.creatorId }),
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
  ticketNumber: number,
  options: { creatorId?: string | null } = {}
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
        tokenSaving: sourceTicket.tokenSaving,
        ...(options.creatorId != null && { creatorId: options.creatorId }),
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

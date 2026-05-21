import { Prisma, Agent, Stage } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { deleteTicketWithCleanup } from '@/lib/tickets/deletion';
import type { TicketRef } from '@/lib/schemas/bulk-ticket';
import type { StageModelKey } from '@/lib/models/claude-models';
import type { TicketAttachment } from '@/app/lib/types/ticket';
import type { TicketWithVersion } from '@/lib/types';
import type { Stage as StageEnum } from '@/lib/stage-transitions';

export type BulkSkipReason =
  | 'NOT_FOUND'
  | 'NOT_IN_INBOX'
  | 'VERSION_CONFLICT'
  | 'ACTIVE_JOB'
  | 'GITHUB_ERROR'
  | 'FORBIDDEN';

export interface SkippedTicket {
  ticketId: number;
  reason: BulkSkipReason;
}

export interface BulkDeleteResponse {
  affected: number[];
  skipped: SkippedTicket[];
  prsClosed: number;
}

export interface BulkAgentAffected {
  ticketId: number;
  version: number;
  agent: Agent | null;
}

export interface BulkAgentResponse {
  affected: BulkAgentAffected[];
  skipped: SkippedTicket[];
}

export interface BulkModelAffected {
  ticketId: number;
  version: number;
  specifyModel: string | null;
  planModel: string | null;
  implementModel: string | null;
  quickImplModel: string | null;
  verifyModel: string | null;
}

export interface BulkModelResponse {
  affected: BulkModelAffected[];
  skipped: SkippedTicket[];
}

export interface FusionSuccess {
  anchor: TicketWithVersion;
  deletedIds: number[];
}

export class FusionConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  readonly conflicting: number[];

  constructor(conflicting: number[]) {
    super('Fusion failed — one or more tickets were modified by another user');
    this.name = 'FusionConflictError';
    this.conflicting = conflicting;
  }
}

/**
 * Translate a Prisma / cleanup error into a per-ticket skip reason.
 * `notFoundFallback` distinguishes "row didn't match WHERE (likely version mismatch)"
 * from "we don't actually know if the row exists" (used for bulk delete where the
 * caller already verified the row existed before invoking cleanup).
 */
export function classifySkipReason(
  error: unknown,
  notFoundFallback: BulkSkipReason = 'NOT_FOUND',
): BulkSkipReason {
  if (error && typeof error === 'object') {
    const maybeCode = (error as { code?: string }).code;
    if (maybeCode === 'ACTIVE_JOB') return 'ACTIVE_JOB';
    if (maybeCode === 'GITHUB_API_ERROR' || maybeCode === 'GITHUB_CONFIG_ERROR') {
      return 'GITHUB_ERROR';
    }
    if (maybeCode === 'INVALID_STAGE') return 'NOT_IN_INBOX';
    if (maybeCode === 'NOT_FOUND') return 'NOT_FOUND';
    if (maybeCode === 'FORBIDDEN') return 'FORBIDDEN';
    if (maybeCode === 'P2025') return 'VERSION_CONFLICT';
  }
  return notFoundFallback;
}

/**
 * Best-effort bulk delete of INBOX tickets. Each ticket is processed through
 * `deleteTicketWithCleanup` inside `Promise.allSettled` so peer failures do not
 * abort siblings. Tickets that don't belong to `projectId` or aren't in INBOX
 * are reported via `skipped[]` instead of being deleted.
 */
export async function bulkDeleteTickets(input: {
  projectId: number;
  tickets: TicketRef[];
}): Promise<BulkDeleteResponse> {
  const { projectId, tickets } = input;

  if (tickets.length === 0) {
    return { affected: [], skipped: [], prsClosed: 0 };
  }

  const ids = tickets.map((t) => t.id);
  const versionById = new Map(tickets.map((t) => [t.id, t.version]));

  const rows = await prisma.ticket.findMany({
    where: { id: { in: ids }, projectId },
    select: { id: true, projectId: true, stage: true, version: true, branch: true },
  });

  const rowById = new Map(rows.map((r) => [r.id, r] as const));

  const affected: number[] = [];
  const skipped: SkippedTicket[] = [];
  let prsClosed = 0;

  const cleanupPromises: Array<Promise<void>> = [];

  for (const ref of tickets) {
    const row = rowById.get(ref.id);
    if (!row) {
      skipped.push({ ticketId: ref.id, reason: 'NOT_FOUND' });
      continue;
    }
    if (row.stage !== Stage.INBOX) {
      skipped.push({ ticketId: ref.id, reason: 'NOT_IN_INBOX' });
      continue;
    }
    const expectedVersion = versionById.get(ref.id);
    if (row.version !== expectedVersion) {
      skipped.push({ ticketId: ref.id, reason: 'VERSION_CONFLICT' });
      continue;
    }

    cleanupPromises.push(
      (async () => {
        try {
          const result = await deleteTicketWithCleanup({
            id: row.id,
            projectId: row.projectId,
            stage: row.stage,
            branch: row.branch,
          });
          if (result.ok) {
            affected.push(row.id);
            prsClosed += result.prsClosed;
          } else {
            const code = (result.body.code as string | undefined) ?? '';
            skipped.push({
              ticketId: row.id,
              reason: classifySkipReason({ code }, 'NOT_FOUND'),
            });
          }
        } catch (error) {
          skipped.push({
            ticketId: row.id,
            reason: classifySkipReason(error, 'NOT_FOUND'),
          });
        }
      })(),
    );
  }

  await Promise.allSettled(cleanupPromises);

  affected.sort((a, b) => a - b);
  skipped.sort((a, b) => a.ticketId - b.ticketId);

  return { affected, skipped, prsClosed };
}

async function classifyMissAfterUpdate(
  projectId: number,
  id: number,
): Promise<BulkSkipReason> {
  const row = await prisma.ticket.findFirst({
    where: { id, projectId },
    select: { stage: true },
  });
  if (!row) return 'NOT_FOUND';
  if (row.stage !== Stage.INBOX) return 'NOT_IN_INBOX';
  return 'VERSION_CONFLICT';
}

/**
 * Best-effort bulk agent update on INBOX tickets.
 * Uses `updateMany` with `version + stage='INBOX'` predicate so a concurrent
 * mutation returns count=0 (reported as a skip) rather than throwing.
 */
export async function bulkSetAgent(input: {
  projectId: number;
  agent: Agent | null;
  tickets: TicketRef[];
}): Promise<BulkAgentResponse> {
  const { projectId, agent, tickets } = input;

  const results = await Promise.allSettled(
    tickets.map(async (ref) => {
      const updated = await prisma.ticket.updateMany({
        where: { id: ref.id, projectId, version: ref.version, stage: Stage.INBOX },
        data: { agent, version: { increment: 1 } },
      });

      if (updated.count === 0) {
        const reason = await classifyMissAfterUpdate(projectId, ref.id);
        return { ok: false as const, ticketId: ref.id, reason };
      }

      const fresh = await prisma.ticket.findUniqueOrThrow({
        where: { id: ref.id },
        select: { id: true, version: true, agent: true },
      });

      return {
        ok: true as const,
        ticketId: fresh.id,
        version: fresh.version,
        agent: fresh.agent,
      };
    }),
  );

  const affected: BulkAgentAffected[] = [];
  const skipped: SkippedTicket[] = [];

  results.forEach((r, i) => {
    const id = tickets[i]!.id;
    if (r.status === 'fulfilled') {
      if (r.value.ok) {
        affected.push({ ticketId: r.value.ticketId, version: r.value.version, agent: r.value.agent });
      } else {
        skipped.push({ ticketId: r.value.ticketId, reason: r.value.reason });
      }
    } else {
      skipped.push({ ticketId: id, reason: classifySkipReason(r.reason) });
    }
  });

  affected.sort((a, b) => a.ticketId - b.ticketId);
  skipped.sort((a, b) => a.ticketId - b.ticketId);

  return { affected, skipped };
}

/**
 * Best-effort bulk per-stage model override.
 * Same shape as `bulkSetAgent`; only the specified `stage` field is touched.
 */
export async function bulkSetModel(input: {
  projectId: number;
  stage: StageModelKey;
  model: string | null;
  tickets: TicketRef[];
}): Promise<BulkModelResponse> {
  const { projectId, stage, model, tickets } = input;

  const results = await Promise.allSettled(
    tickets.map(async (ref) => {
      const updated = await prisma.ticket.updateMany({
        where: { id: ref.id, projectId, version: ref.version, stage: Stage.INBOX },
        data: { [stage]: model, version: { increment: 1 } },
      });

      if (updated.count === 0) {
        const reason = await classifyMissAfterUpdate(projectId, ref.id);
        return { ok: false as const, ticketId: ref.id, reason };
      }

      const fresh = await prisma.ticket.findUniqueOrThrow({
        where: { id: ref.id },
        select: {
          id: true,
          version: true,
          specifyModel: true,
          planModel: true,
          implementModel: true,
          quickImplModel: true,
          verifyModel: true,
        },
      });

      return { ok: true as const, ticketId: fresh.id, ...fresh } as const;
    }),
  );

  const affected: BulkModelAffected[] = [];
  const skipped: SkippedTicket[] = [];

  results.forEach((r, i) => {
    const id = tickets[i]!.id;
    if (r.status === 'fulfilled') {
      if (r.value.ok) {
        affected.push({
          ticketId: r.value.ticketId,
          version: r.value.version,
          specifyModel: r.value.specifyModel,
          planModel: r.value.planModel,
          implementModel: r.value.implementModel,
          quickImplModel: r.value.quickImplModel,
          verifyModel: r.value.verifyModel,
        });
      } else {
        skipped.push({ ticketId: r.value.ticketId, reason: r.value.reason });
      }
    } else {
      skipped.push({ ticketId: id, reason: classifySkipReason(r.reason) });
    }
  });

  affected.sort((a, b) => a.ticketId - b.ticketId);
  skipped.sort((a, b) => a.ticketId - b.ticketId);

  return { affected, skipped };
}

/**
 * Atomic fusion: update the anchor's title/description/attachments and delete
 * the absorbed tickets in a single transaction. On any version mismatch or
 * stage drift, throw `FusionConflictError` so the entire transaction rolls back.
 */
export async function fuseTickets(input: {
  projectId: number;
  anchorId: number;
  anchorVersion: number;
  title: string;
  description: string;
  attachments: TicketAttachment[];
  absorbed: TicketRef[];
}): Promise<FusionSuccess> {
  const { projectId, anchorId, anchorVersion, title, description, attachments, absorbed } = input;

  const absorbedIds = absorbed.map((a) => a.id);
  const absorbedVersionById = new Map(absorbed.map((a) => [a.id, a.version]));

  return prisma.$transaction(async (tx) => {
    const rows = await tx.ticket.findMany({
      where: { id: { in: [anchorId, ...absorbedIds] }, projectId },
      select: { id: true, version: true, stage: true },
    });
    const rowById = new Map(rows.map((r) => [r.id, r] as const));

    const conflicting: number[] = [];

    const anchorRow = rowById.get(anchorId);
    if (!anchorRow) {
      conflicting.push(anchorId);
    } else if (anchorRow.stage !== Stage.INBOX || anchorRow.version !== anchorVersion) {
      conflicting.push(anchorId);
    }

    for (const id of absorbedIds) {
      const row = rowById.get(id);
      if (!row) {
        conflicting.push(id);
        continue;
      }
      if (row.stage !== Stage.INBOX || row.version !== absorbedVersionById.get(id)) {
        conflicting.push(id);
      }
    }

    if (conflicting.length > 0) {
      throw new FusionConflictError(conflicting);
    }

    const anchorUpdate = await tx.ticket.updateMany({
      where: { id: anchorId, projectId, version: anchorVersion, stage: Stage.INBOX },
      data: {
        title,
        description,
        attachments: attachments as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
    if (anchorUpdate.count !== 1) {
      throw new FusionConflictError([anchorId]);
    }

    const deleted = await tx.ticket.deleteMany({
      where: { id: { in: absorbedIds }, projectId, stage: Stage.INBOX },
    });
    if (deleted.count !== absorbedIds.length) {
      throw new FusionConflictError(absorbedIds);
    }

    const updatedAnchor = await tx.ticket.findUniqueOrThrow({
      where: { id: anchorId },
      include: {
        jobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, command: true, createdAt: true, qualityScore: true },
        },
        project: {
          select: {
            clarificationPolicy: true,
            defaultAgent: true,
            githubOwner: true,
            githubRepo: true,
          },
        },
      },
    });

    const anchorPayload: TicketWithVersion = {
      id: updatedAnchor.id,
      ticketNumber: updatedAnchor.ticketNumber,
      ticketKey: updatedAnchor.ticketKey,
      title: updatedAnchor.title,
      description: updatedAnchor.description,
      stage: updatedAnchor.stage as StageEnum,
      version: updatedAnchor.version,
      projectId: updatedAnchor.projectId,
      branch: updatedAnchor.branch,
      previewUrl: updatedAnchor.previewUrl,
      autoMode: updatedAnchor.autoMode,
      clarificationPolicy: updatedAnchor.clarificationPolicy,
      agent: updatedAnchor.agent,
      specifyModel: updatedAnchor.specifyModel,
      planModel: updatedAnchor.planModel,
      implementModel: updatedAnchor.implementModel,
      quickImplModel: updatedAnchor.quickImplModel,
      verifyModel: updatedAnchor.verifyModel,
      workflowType: updatedAnchor.workflowType,
      attachments: updatedAnchor.attachments,
      qualityScore: updatedAnchor.jobs[0]?.qualityScore ?? null,
      createdAt: updatedAnchor.createdAt.toISOString(),
      updatedAt: updatedAnchor.updatedAt.toISOString(),
      ...(updatedAnchor.project && {
        project: {
          clarificationPolicy: updatedAnchor.project.clarificationPolicy,
          defaultAgent: updatedAnchor.project.defaultAgent,
          githubOwner: updatedAnchor.project.githubOwner,
          githubRepo: updatedAnchor.project.githubRepo,
        },
      }),
      jobs: updatedAnchor.jobs.map((j) => ({
        status: j.status,
        command: j.command,
        createdAt: j.createdAt,
      })),
    };

    return { anchor: anchorPayload, deletedIds: absorbedIds };
  });
}

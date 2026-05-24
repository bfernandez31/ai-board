import type { Agent, Prisma, Ticket } from '@prisma/client';
import { isTicketAttachmentArray, type TicketAttachment } from '@/app/lib/types/ticket';

export type BulkResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: Record<string, unknown> };

export class BulkConflictError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === 'string' ? body.error : 'Bulk conflict');
    this.status = status;
    this.body = body;
  }
}

interface AssertOkResult {
  ok: true;
  tickets: Ticket[];
}

interface AssertConflictResult {
  ok: false;
  status: 409;
  body: {
    error: string;
    code: 'BULK_CONFLICT_STAGE_DRIFT';
    details: { conflictingIds: number[] };
  };
}

interface AssertCrossProjectResult {
  ok: false;
  status: 403;
  body: {
    error: string;
    code: 'FORBIDDEN_CROSS_PROJECT';
    details: { conflictingIds: number[] };
  };
}

export type AssertInboxResult =
  | AssertOkResult
  | AssertConflictResult
  | AssertCrossProjectResult;

/**
 * Re-fetch the requested tickets inside the transaction with the INBOX + projectId
 * filter. Returns the rows if every requested id is present and INBOX. Missing ids
 * that resolve to a different project yield 403 FORBIDDEN_CROSS_PROJECT; the rest
 * yield 409 BULK_CONFLICT_STAGE_DRIFT.
 */
export async function assertInboxAndProject(
  tx: Prisma.TransactionClient,
  projectId: number,
  ticketIds: number[]
): Promise<AssertInboxResult> {
  const tickets = await tx.ticket.findMany({
    where: { id: { in: ticketIds }, projectId, stage: 'INBOX' },
  });

  if (tickets.length !== ticketIds.length) {
    const found = new Set(tickets.map((t) => t.id));
    const missingIds = ticketIds.filter((id) => !found.has(id));
    const crossProject = await tx.ticket.findMany({
      where: { id: { in: missingIds } },
      select: { id: true, projectId: true },
    });
    const crossProjectIds = crossProject
      .filter((t) => t.projectId !== projectId)
      .map((t) => t.id);
    if (crossProjectIds.length > 0) {
      return {
        ok: false,
        status: 403,
        body: {
          error: 'One or more tickets belong to a different project',
          code: 'FORBIDDEN_CROSS_PROJECT',
          details: { conflictingIds: crossProjectIds },
        },
      };
    }
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Some tickets are no longer in INBOX or do not belong to this project',
        code: 'BULK_CONFLICT_STAGE_DRIFT',
        details: { conflictingIds: missingIds },
      },
    };
  }

  return { ok: true, tickets };
}

function detectVersionMismatch(
  tickets: Ticket[],
  expectedVersions: Record<string, number>
): { conflictingIds: number[]; currentVersions: Record<number, number> } | null {
  const conflictingIds: number[] = [];
  const currentVersions: Record<number, number> = {};
  for (const ticket of tickets) {
    const expected = expectedVersions[String(ticket.id)];
    if (expected === undefined || ticket.version !== expected) {
      conflictingIds.push(ticket.id);
      currentVersions[ticket.id] = ticket.version;
    }
  }
  return conflictingIds.length > 0 ? { conflictingIds, currentVersions } : null;
}

interface BulkDeleteParams {
  projectId: number;
  ticketIds: number[];
  expectedVersions: Record<string, number>;
  actorId: string;
}

interface BulkDeleteOk {
  deleted: { count: number; ticketKeys: string[] };
  notifiedCreatorIds: string[];
}

/**
 * Bulk delete INBOX tickets atomically. Caller wraps in prisma.$transaction.
 * Notifications for non-actor creators are created BEFORE the deleteMany so
 * that the SetNull cascade on Notification.ticketId still records the source.
 */
export async function bulkDeleteInbox(
  tx: Prisma.TransactionClient,
  { projectId, ticketIds, expectedVersions, actorId }: BulkDeleteParams
): Promise<BulkResult<BulkDeleteOk>> {
  const precheck = await assertInboxAndProject(tx, projectId, ticketIds);
  if (!precheck.ok) return precheck;

  const versionConflict = detectVersionMismatch(precheck.tickets, expectedVersions);
  if (versionConflict) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Some tickets were modified by another user',
        code: 'BULK_CONFLICT_VERSION',
        details: versionConflict,
      },
    };
  }

  const notificationRecipients = precheck.tickets
    .filter((t) => t.creatorId && t.creatorId !== actorId)
    .map((t) => ({
      recipientId: t.creatorId as string,
      actorId,
      ticketId: t.id,
      commentId: null,
      type: 'TICKET_DELETED' as const,
      ticketKeySnapshot: t.ticketKey,
      projectIdSnapshot: t.projectId,
    }));

  if (notificationRecipients.length > 0) {
    await tx.notification.createMany({ data: notificationRecipients });
  }

  const deleteResult = await tx.ticket.deleteMany({
    where: { id: { in: ticketIds }, projectId, stage: 'INBOX' },
  });

  if (deleteResult.count !== ticketIds.length) {
    throw new BulkConflictError(409, {
      error: 'Some tickets drifted out of INBOX during bulk delete',
      code: 'BULK_CONFLICT_STAGE_DRIFT',
      details: { conflictingIds: ticketIds },
    });
  }

  return {
    ok: true,
    data: {
      deleted: {
        count: precheck.tickets.length,
        ticketKeys: precheck.tickets.map((t) => t.ticketKey),
      },
      notifiedCreatorIds: notificationRecipients.map((n) => n.recipientId),
    },
  };
}

interface BulkMergeParams {
  projectId: number;
  baseTicketId: number;
  sourceTicketIds: number[];
  title: string;
  description: string;
  expectedVersions: Record<string, number>;
  actorId: string;
}

interface BulkMergeOk {
  base: {
    id: number;
    ticketKey: string;
    title: string;
    description: string;
    version: number;
    attachmentCount: number;
    updatedAt: string;
  };
  deleted: { count: number; ticketKeys: string[] };
  notifiedCreatorIds: string[];
}

function readAttachments(value: unknown): TicketAttachment[] {
  return isTicketAttachmentArray(value) ? value : [];
}

export async function bulkMergeInbox(
  tx: Prisma.TransactionClient,
  {
    projectId,
    baseTicketId,
    sourceTicketIds,
    title,
    description,
    expectedVersions,
    actorId,
  }: BulkMergeParams
): Promise<BulkResult<BulkMergeOk>> {
  const allIds = [baseTicketId, ...sourceTicketIds];
  const precheck = await assertInboxAndProject(tx, projectId, allIds);
  if (!precheck.ok) return precheck;

  const versionConflict = detectVersionMismatch(precheck.tickets, expectedVersions);
  if (versionConflict) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Some tickets were modified by another user',
        code: 'BULK_CONFLICT_VERSION',
        details: versionConflict,
      },
    };
  }

  const byId = new Map(precheck.tickets.map((t) => [t.id, t]));
  const base = byId.get(baseTicketId);
  if (!base) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Base ticket missing from project INBOX',
        code: 'BULK_CONFLICT_STAGE_DRIFT',
        details: { conflictingIds: [baseTicketId] },
      },
    };
  }

  const sourcesAsc = sourceTicketIds
    .map((id) => byId.get(id))
    .filter((t): t is Ticket => t != null)
    .sort((a, b) => a.id - b.id);

  const mergedAttachments: TicketAttachment[] = [
    ...readAttachments(base.attachments),
    ...sourcesAsc.flatMap((s) => readAttachments(s.attachments)),
  ];

  const notificationRecipients = sourcesAsc
    .filter((t) => t.creatorId && t.creatorId !== actorId)
    .map((t) => ({
      recipientId: t.creatorId as string,
      actorId,
      ticketId: t.id,
      commentId: null,
      type: 'TICKET_MERGED' as const,
      mergedIntoTicketId: baseTicketId,
      ticketKeySnapshot: t.ticketKey,
      projectIdSnapshot: base.projectId,
    }));

  if (notificationRecipients.length > 0) {
    await tx.notification.createMany({ data: notificationRecipients });
  }

  let updatedBase: Ticket;
  try {
    updatedBase = await tx.ticket.update({
      where: { id: baseTicketId, version: base.version },
      data: {
        title,
        description,
        attachments: mergedAttachments as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code: string }).code === 'P2025') {
      const current = await tx.ticket.findUnique({
        where: { id: baseTicketId },
        select: { version: true },
      });
      const currentVersions: Record<number, number> =
        current != null ? { [baseTicketId]: current.version } : {};
      throw new BulkConflictError(409, {
        error: 'Base ticket was modified by another user',
        code: 'BULK_CONFLICT_VERSION',
        details: { conflictingIds: [baseTicketId], currentVersions },
      });
    }
    throw err;
  }

  const deleteResult = await tx.ticket.deleteMany({
    where: { id: { in: sourceTicketIds }, projectId, stage: 'INBOX' },
  });

  if (deleteResult.count !== sourceTicketIds.length) {
    throw new BulkConflictError(409, {
      error: 'Some source tickets drifted out of INBOX during merge',
      code: 'BULK_CONFLICT_STAGE_DRIFT',
      details: { conflictingIds: sourceTicketIds },
    });
  }

  return {
    ok: true,
    data: {
      base: {
        id: updatedBase.id,
        ticketKey: updatedBase.ticketKey,
        title: updatedBase.title,
        description: updatedBase.description,
        version: updatedBase.version,
        attachmentCount: mergedAttachments.length,
        updatedAt: updatedBase.updatedAt.toISOString(),
      },
      deleted: {
        count: sourcesAsc.length,
        ticketKeys: sourcesAsc.map((t) => t.ticketKey),
      },
      notifiedCreatorIds: notificationRecipients.map((n) => n.recipientId),
    },
  };
}

interface BulkAgentParams {
  projectId: number;
  ticketIds: number[];
  agent: Agent | null;
}

interface BulkAgentOk {
  updated: { count: number; ticketIds: number[]; agent: Agent | null };
}

export async function bulkUpdateInboxAgent(
  tx: Prisma.TransactionClient,
  { projectId, ticketIds, agent }: BulkAgentParams
): Promise<BulkResult<BulkAgentOk>> {
  const precheck = await assertInboxAndProject(tx, projectId, ticketIds);
  if (!precheck.ok) return precheck;

  const updateResult = await tx.ticket.updateMany({
    where: { id: { in: ticketIds }, projectId, stage: 'INBOX' },
    data: {
      agent,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  if (updateResult.count !== ticketIds.length) {
    throw new BulkConflictError(409, {
      error: 'Some tickets drifted out of INBOX during bulk agent update',
      code: 'BULK_CONFLICT_STAGE_DRIFT',
      details: { conflictingIds: ticketIds },
    });
  }

  return {
    ok: true,
    data: {
      updated: {
        count: precheck.tickets.length,
        ticketIds: precheck.tickets.map((t) => t.id),
        agent,
      },
    },
  };
}

interface BulkModelParams {
  projectId: number;
  ticketIds: number[];
  model: string | null;
}

const MODEL_APPLIED_FIELDS = [
  'specifyModel',
  'planModel',
  'implementModel',
  'quickImplModel',
  'verifyModel',
] as const;

interface BulkModelOk {
  updated: {
    count: number;
    ticketIds: number[];
    model: string | null;
    appliedFields: typeof MODEL_APPLIED_FIELDS;
  };
}

export async function bulkUpdateInboxModel(
  tx: Prisma.TransactionClient,
  { projectId, ticketIds, model }: BulkModelParams
): Promise<BulkResult<BulkModelOk>> {
  const precheck = await assertInboxAndProject(tx, projectId, ticketIds);
  if (!precheck.ok) return precheck;

  const updateResult = await tx.ticket.updateMany({
    where: { id: { in: ticketIds }, projectId, stage: 'INBOX' },
    data: {
      specifyModel: model,
      planModel: model,
      implementModel: model,
      quickImplModel: model,
      verifyModel: model,
      version: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  if (updateResult.count !== ticketIds.length) {
    throw new BulkConflictError(409, {
      error: 'Some tickets drifted out of INBOX during bulk model update',
      code: 'BULK_CONFLICT_STAGE_DRIFT',
      details: { conflictingIds: ticketIds },
    });
  }

  return {
    ok: true,
    data: {
      updated: {
        count: precheck.tickets.length,
        ticketIds: precheck.tickets.map((t) => t.id),
        model,
        appliedFields: MODEL_APPLIED_FIELDS,
      },
    },
  };
}

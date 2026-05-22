import { Prisma, Stage, type Agent } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { STAGE_MODEL_KEYS } from '@/lib/models/claude-models';

export interface BulkUpdateResult {
  results: {
    succeeded: Array<{ ticketId: number; ticketKey: string; version: number }>;
    skipped: Array<{ ticketId: number; ticketKey: string; reason: string }>;
  };
  summary: { total: number; succeeded: number; skipped: number };
}

async function bulkUpdateInboxTickets(
  projectId: number,
  ticketIds: number[],
  data: Prisma.TicketUpdateInput
): Promise<BulkUpdateResult> {
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: ticketIds }, projectId, stage: Stage.INBOX },
    select: { id: true, ticketKey: true, version: true },
  });

  const foundIds = new Set(tickets.map((t) => t.id));
  const skipped: BulkUpdateResult['results']['skipped'] = [];
  const succeeded: BulkUpdateResult['results']['succeeded'] = [];

  for (const id of ticketIds) {
    if (!foundIds.has(id)) {
      skipped.push({ ticketId: id, ticketKey: `unknown-${id}`, reason: 'Ticket not found or not in INBOX' });
    }
  }

  // Issue per-ticket conditional updates in parallel. The version constraint
  // gives us optimistic concurrency: if a concurrent writer bumped the row's
  // version (or moved it out of INBOX, or to another project) between the
  // findMany above and the update here, `updateMany` returns count: 0 and we
  // record a skip instead of silently overwriting the conflicting change.
  const updateResults = await Promise.all(
    tickets.map((ticket) =>
      prisma.ticket
        .updateMany({
          where: {
            id: ticket.id,
            projectId,
            stage: Stage.INBOX,
            version: ticket.version,
          },
          data: { ...data, version: { increment: 1 } },
        })
        .then(
          (r) => ({ ticket, count: r.count, error: null as Error | null }),
          (error: Error) => ({ ticket, count: 0, error })
        )
    )
  );

  for (const { ticket, count, error } of updateResults) {
    if (error) {
      // Surface unexpected DB errors instead of treating every failure as a
      // concurrency skip — those would mask real bugs.
      throw error;
    }
    if (count > 0) {
      succeeded.push({
        ticketId: ticket.id,
        ticketKey: ticket.ticketKey,
        version: ticket.version + 1,
      });
    } else {
      skipped.push({
        ticketId: ticket.id,
        ticketKey: ticket.ticketKey,
        reason: 'Concurrent modification',
      });
    }
  }

  return {
    results: { succeeded, skipped },
    summary: { total: ticketIds.length, succeeded: succeeded.length, skipped: skipped.length },
  };
}

export function bulkUpdateAgent(
  projectId: number,
  ticketIds: number[],
  agent: Agent
): Promise<BulkUpdateResult> {
  return bulkUpdateInboxTickets(projectId, ticketIds, { agent });
}

export function bulkUpdateModel(
  projectId: number,
  ticketIds: number[],
  model: string
): Promise<BulkUpdateResult> {
  const modelData: Prisma.TicketUpdateInput = {};
  for (const key of STAGE_MODEL_KEYS) {
    modelData[key] = model;
  }
  return bulkUpdateInboxTickets(projectId, ticketIds, modelData);
}

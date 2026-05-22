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

  for (const ticket of tickets) {
    try {
      const updated = await prisma.ticket.update({
        where: { id: ticket.id },
        data: { ...data, version: { increment: 1 } },
        select: { id: true, ticketKey: true, version: true },
      });
      succeeded.push({ ticketId: updated.id, ticketKey: updated.ticketKey, version: updated.version });
    } catch {
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

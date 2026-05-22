import { Stage, JobStatus } from '@prisma/client';
import { prisma } from '@/lib/db/client';

export class ResponseError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface MergeResult {
  baseTicket: {
    id: number;
    ticketKey: string;
    title: string;
    description: string | null;
    attachments: unknown;
    version: number;
  };
  deletedTickets: Array<{ ticketId: number; ticketKey: string }>;
  summary: { merged: number; deleted: number };
}

export async function mergeInboxTickets(
  projectId: number,
  ticketIds: number[],
  mergedTitle: string,
  mergedDescription: string,
  selectedAttachments: string[]
): Promise<MergeResult> {
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: ticketIds }, projectId, stage: Stage.INBOX },
    select: { id: true, ticketKey: true, title: true, description: true, attachments: true, version: true },
    orderBy: { id: 'asc' },
  });

  if (tickets.length < 2) {
    throw new ResponseError(400, 'At least 2 INBOX tickets required for merge');
  }

  const missingIds = ticketIds.filter((id) => !tickets.some((t) => t.id === id));
  if (missingIds.length > 0) {
    throw new ResponseError(404, `Tickets not found or not in INBOX: ${missingIds.join(', ')}`);
  }

  const activeJobs = await prisma.job.findMany({
    where: {
      ticketId: { in: tickets.map((t) => t.id) },
      status: { in: [JobStatus.PENDING, JobStatus.RUNNING] },
    },
    select: { ticketId: true },
  });

  if (activeJobs.length > 0) {
    const activeTicketIds = activeJobs.map((j) => j.ticketId);
    const activeKeys = tickets
      .filter((t) => activeTicketIds.includes(t.id))
      .map((t) => t.ticketKey);
    throw new ResponseError(400, `Cannot merge: tickets with active jobs: ${activeKeys.join(', ')}`);
  }

  const baseTicket = tickets[0]!;
  const sourceTickets = tickets.slice(1);
  const sourceIds = sourceTickets.map((t) => t.id);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.ticket.update({
      where: { id: baseTicket.id },
      data: {
        title: mergedTitle,
        description: mergedDescription,
        attachments: selectedAttachments,
        version: { increment: 1 },
      },
      select: { id: true, ticketKey: true, title: true, description: true, attachments: true, version: true },
    });

    await tx.ticket.deleteMany({ where: { id: { in: sourceIds } } });

    return result;
  });

  return {
    baseTicket: updated,
    deletedTickets: sourceTickets.map((t) => ({ ticketId: t.id, ticketKey: t.ticketKey })),
    summary: { merged: tickets.length, deleted: sourceTickets.length },
  };
}

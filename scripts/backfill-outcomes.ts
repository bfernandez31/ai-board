/**
 * Per-project historical outcome backfill.
 *
 * Usage:
 *   bun run scripts/backfill-outcomes.ts --project-id 7 [--resume-cursor 1234]
 *
 * Reuses lib/outcomes/capture.ts so live capture and backfill share derivation.
 * Idempotent (P2002 → no-op). Resumable via BackfillProgress.lastProcessedTicketId.
 */

import { PrismaClient, Stage, type WorkflowType } from '@prisma/client';
import { captureOutcomeOnShip } from '@/lib/outcomes/capture';
import { ensureFreshConfig } from '@/lib/config-sync';

interface CliArgs {
  projectId: number;
  resumeCursor: number | null;
}

function parseArgs(argv: string[]): CliArgs {
  let projectId: number | null = null;
  let resumeCursor: number | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--project-id') {
      projectId = parseInt(argv[++i] ?? '', 10);
    } else if (arg === '--resume-cursor') {
      const next = argv[++i] ?? '';
      const parsed = parseInt(next, 10);
      resumeCursor = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }
  }
  if (!projectId || !Number.isFinite(projectId)) {
    throw new Error('Missing or invalid --project-id');
  }
  return { projectId, resumeCursor };
}

async function ensureProgressRow(
  prisma: PrismaClient,
  projectId: number
): Promise<void> {
  await prisma.backfillProgress.upsert({
    where: { projectId },
    update: {},
    create: { projectId, status: 'IN_PROGRESS' },
  });
}

async function advanceProgress(
  prisma: PrismaClient,
  projectId: number,
  lastProcessedTicketId: number,
  partialDelta: number,
  prevVersion: number
): Promise<{ ok: boolean; newVersion: number }> {
  const result = await prisma.backfillProgress.updateMany({
    where: { projectId, version: prevVersion },
    data: {
      lastProcessedTicketId,
      ticketsProcessed: { increment: 1 },
      ticketsWithPartial: { increment: partialDelta },
      version: { increment: 1 },
    },
  });
  return { ok: result.count === 1, newVersion: prevVersion + 1 };
}

async function markCompleted(prisma: PrismaClient, projectId: number): Promise<void> {
  await prisma.backfillProgress.update({
    where: { projectId },
    data: { status: 'COMPLETED', completedAt: new Date(), lastError: null },
  });
}

async function markFailed(
  prisma: PrismaClient,
  projectId: number,
  message: string
): Promise<void> {
  await prisma.backfillProgress.update({
    where: { projectId },
    data: { status: 'FAILED', lastError: message.substring(0, 2000) },
  });
}

async function readVersion(
  prisma: PrismaClient,
  projectId: number
): Promise<number> {
  const row = await prisma.backfillProgress.findUnique({
    where: { projectId },
    select: { version: true },
  });
  return row?.version ?? 1;
}

const PAGE_SIZE = 100;

export async function runBackfill(opts: CliArgs): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // Phase 1: bootstrap
    const project = await prisma.project.findUnique({ where: { id: opts.projectId } });
    if (!project) {
      console.error(`[backfill] project ${opts.projectId} not found`);
      process.exit(1);
    }
    try {
      await ensureFreshConfig(project);
    } catch (err) {
      console.warn('[backfill] config sync skipped (non-fatal):', err);
    }
    await ensureProgressRow(prisma, opts.projectId);

    // Initial cursor (the resume point). On first run this is null = start from newest.
    let cursor: number | null = opts.resumeCursor;
    if (cursor === null) {
      const progress = await prisma.backfillProgress.findUnique({
        where: { projectId: opts.projectId },
        select: { lastProcessedTicketId: true },
      });
      cursor = progress?.lastProcessedTicketId ?? null;
    }

    let version = await readVersion(prisma, opts.projectId);

    while (true) {
      // Phase 2: enumerate next page of unfilled SHIP tickets
      const where = {
        projectId: opts.projectId,
        stage: Stage.SHIP,
        outcome: { is: null },
        ...(cursor !== null ? { id: { lt: cursor } } : {}),
      };
      const tickets = await prisma.ticket.findMany({
        where,
        select: { id: true, workflowType: true, updatedAt: true },
        orderBy: { id: 'desc' },
        take: PAGE_SIZE,
      });
      if (tickets.length === 0) break;

      // Phase 3: per-ticket capture
      for (const ticket of tickets) {
        try {
          const result = await captureOutcomeOnShip({
            ticketId: ticket.id,
            projectId: opts.projectId,
            workflowType: ticket.workflowType as WorkflowType,
            shippedAt: ticket.updatedAt,
          });
          const partialDelta = result.partial ? 1 : 0;
          const advanced = await advanceProgress(
            prisma,
            opts.projectId,
            ticket.id,
            partialDelta,
            version
          );
          if (!advanced.ok) {
            console.warn('[backfill] optimistic-lock collision; another worker is advancing — exiting');
            return;
          }
          version = advanced.newVersion;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[backfill] capture failed for ticket ${ticket.id}:`, message);
          await markFailed(prisma, opts.projectId, `ticket ${ticket.id}: ${message}`);
          process.exit(1);
        }
      }

      cursor = tickets[tickets.length - 1]!.id;
    }

    // Phase 5: termination
    await markCompleted(prisma, opts.projectId);
    console.log('[backfill] complete');
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectInvocation =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  /backfill-outcomes\.ts$/.test(process.argv[1]);

if (isDirectInvocation) {
  runBackfill(parseArgs(process.argv.slice(2))).catch((err) => {
    console.error('[backfill] unhandled error', err);
    process.exit(1);
  });
}

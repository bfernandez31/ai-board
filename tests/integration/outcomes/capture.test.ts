/**
 * Integration: Ticket-outcome capture (DB-backed, no GitHub).
 *
 * Verifies that:
 *  1. captureOutcomeForTicket persists a row when a ticket is in SHIP
 *  2. it is idempotent (skipped on re-run)
 *  3. tickets without a branch get a partial record (hasCommitData=false)
 *  4. job-level signals are aggregated correctly across pipeline + friction jobs
 *  5. backfill is resumable and only fills missing rows
 *
 * GitHub diff fetching is intentionally bypassed — the test env has a
 * placeholder GITHUB_TOKEN, so fetchTicketDiff returns null and the captured
 * outcome correctly reflects the partial-record path. Diff parsing logic is
 * exhaustively covered by the unit tests in tests/unit/outcomes/.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Stage } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { captureOutcomeForTicket } from '@/lib/outcomes/capture';
import { backfillProjectOutcomes } from '@/lib/outcomes/backfill';
import { executeTicketTransition } from '@/lib/tickets/transition';

describe('Ticket Outcome capture (integration)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  async function createShippedTicket(opts: {
    branch?: string | null;
    jobs: Array<{
      command: string;
      status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
      costUsd?: number;
      durationMs?: number;
      qualityScore?: number;
    }>;
  }): Promise<number> {
    const ticket = await ctx.createTicket({ stage: 'INBOX' });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'SHIP', branch: opts.branch ?? null },
    });
    let started = Date.now() - opts.jobs.length * 1000;
    for (const j of opts.jobs) {
      started += 1000;
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: j.command,
          status: j.status ?? 'COMPLETED',
          costUsd: j.costUsd ?? null,
          durationMs: j.durationMs ?? null,
          qualityScore: j.qualityScore ?? null,
          startedAt: new Date(started),
          updatedAt: new Date(started),
        },
      });
    }
    return ticket.id;
  }

  it('persists an outcome row for a shipped ticket and is idempotent', async () => {
    const ticketId = await createShippedTicket({
      jobs: [
        { command: 'specify', costUsd: 0.1, durationMs: 1000 },
        { command: 'plan', costUsd: 0.2, durationMs: 2000 },
        { command: 'implement', costUsd: 0.5, durationMs: 5000 },
        { command: 'verify', costUsd: 0.3, durationMs: 3000, qualityScore: 92 },
      ],
    });

    const first = await captureOutcomeForTicket(ticketId);
    expect(first.status).toBe('created');

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row).not.toBeNull();
    expect(row?.totalCostUsd).toBeCloseTo(1.1, 5);
    expect(row?.totalDurationMs).toBe(11_000);
    expect(row?.pipelineJobCount).toBe(4);
    expect(row?.frictionJobCount).toBe(0);
    expect(row?.finalQualityScore).toBe(92);
    expect(row?.frictionFree).toBe(true);
    expect(row?.hasCommitData).toBe(false);

    // Re-run — outcome must be a snapshot, never recomputed.
    const second = await captureOutcomeForTicket(ticketId);
    expect(second.status).toBe('skipped_existing');
    const reread = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(reread?.computedAt.toISOString()).toBe(row?.computedAt.toISOString());
  });

  it('classifies iterate and comment-* jobs as friction and disables frictionFree', async () => {
    const ticketId = await createShippedTicket({
      jobs: [
        { command: 'specify' },
        { command: 'plan' },
        { command: 'implement' },
        { command: 'verify', qualityScore: 88 },
        { command: 'iterate', qualityScore: 95 },
        { command: 'comment-build' },
      ],
    });

    await captureOutcomeForTicket(ticketId);
    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });

    expect(row?.pipelineJobCount).toBe(4);
    expect(row?.frictionJobCount).toBe(2);
    expect(row?.frictionFree).toBe(false);
    // Latest verify-class quality score wins
    expect(row?.finalQualityScore).toBe(95);
  });

  it('records partial outcome (hasCommitData=false) when ticket has no branch', async () => {
    const ticketId = await createShippedTicket({
      branch: null,
      jobs: [{ command: 'quick-impl', costUsd: 0.05, durationMs: 500 }],
    });

    const result = await captureOutcomeForTicket(ticketId);
    expect(result.status).toBe('created');

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId } });
    expect(row?.hasCommitData).toBe(false);
    expect(row?.filesTouched).toBeNull();
    expect(row?.linesAdded).toBeNull();
    expect(row?.linesRemoved).toBeNull();
    expect(row?.structuralDomains).toEqual([]);
    expect(row?.semanticTags).toEqual([]);
    // Quick-impl bypasses verify, so no quality score → frictionFree still true
    expect(row?.frictionFree).toBe(true);
  });

  it('refuses to capture when ticket is not in SHIP', async () => {
    const ticket = await ctx.createTicket({ stage: 'INBOX' });
    const result = await captureOutcomeForTicket(ticket.id);
    expect(result.status).toBe('ticket_not_shipped');
    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId: ticket.id } });
    expect(row).toBeNull();
  });

  it('returns ticket_not_found for an unknown ticket', async () => {
    const result = await captureOutcomeForTicket(999_999_999);
    expect(result.status).toBe('ticket_not_found');
  });

  it('backfill creates rows for all missing shipped tickets and is resumable', async () => {
    const ids = await Promise.all([
      createShippedTicket({ jobs: [{ command: 'specify' }, { command: 'verify', qualityScore: 90 }] }),
      createShippedTicket({ jobs: [{ command: 'specify' }, { command: 'verify', qualityScore: 85 }] }),
      createShippedTicket({ jobs: [{ command: 'specify' }, { command: 'verify', qualityScore: 75 }] }),
    ]);

    const first = await backfillProjectOutcomes(ctx.projectId, { delayMs: 0 });
    expect(first.scanned).toBe(3);
    expect(first.created).toBe(3);
    expect(first.failed).toBe(0);

    const rows = await prisma.ticketOutcome.findMany({
      where: { ticketId: { in: ids } },
      orderBy: { ticketId: 'asc' },
    });
    expect(rows).toHaveLength(3);

    // Re-run: nothing left to do — scanned reflects only un-captured tickets,
    // so a fully-backfilled project produces an empty pass.
    const second = await backfillProjectOutcomes(ctx.projectId, { delayMs: 0 });
    expect(second.scanned).toBe(0);
    expect(second.created).toBe(0);
  });

  it('executeTicketTransition VERIFY→SHIP triggers outcome capture', async () => {
    // Set up a ticket already in VERIFY with a completed verify job — the
    // shape that auto-ship.yml leaves behind before flipping to SHIP.
    const ticket = await ctx.createTicket({ stage: 'INBOX' });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { stage: 'VERIFY', branch: null, version: 5 },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        costUsd: 0.4,
        durationMs: 4000,
        qualityScore: 91,
        startedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await executeTicketTransition(
      ctx.projectId,
      String(ticket.id),
      Stage.SHIP
    );
    expect(result.ok).toBe(true);

    const row = await prisma.ticketOutcome.findUnique({ where: { ticketId: ticket.id } });
    expect(row).not.toBeNull();
    expect(row?.finalQualityScore).toBe(91);
    expect(row?.frictionFree).toBe(true);
    expect(row?.pipelineJobCount).toBe(1);
    expect(row?.frictionJobCount).toBe(0);
  });

  it('backfill respects the limit option for chunked runs', async () => {
    await Promise.all([
      createShippedTicket({ jobs: [{ command: 'specify' }] }),
      createShippedTicket({ jobs: [{ command: 'specify' }] }),
      createShippedTicket({ jobs: [{ command: 'specify' }] }),
    ]);

    const result = await backfillProjectOutcomes(ctx.projectId, { delayMs: 0, limit: 2 });
    expect(result.scanned).toBe(2);
    expect(result.created).toBe(2);

    const total = await prisma.ticketOutcome.count({ where: { projectId: ctx.projectId } });
    expect(total).toBe(2);
  });
});

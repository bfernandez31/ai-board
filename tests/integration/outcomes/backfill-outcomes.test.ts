/**
 * Integration tests for backfill (T031, T033, T034 — US3).
 *
 * Drives the runBackfill function directly against seeded fixtures. Covers:
 *   - First run writes N rows; second run is a no-op (idempotency / SC-005)
 *   - Concurrent live capture for an in-flight ticket: still exactly one row
 *   - Tickets where Octokit fails get partial=true rows and the loop continues
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { runBackfill } from '@/scripts/backfill-outcomes';
import { captureOutcomeOnShip } from '@/lib/outcomes/capture';
import * as githubFiles from '@/lib/outcomes/github-files';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TEST_OUTCOME_FILES;
});

describe('Backfill outcomes', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  async function seedTicket(num: number, stage: Stage): Promise<number> {
    const t = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: `[e2e] backfill ${num}`,
        description: 'x',
        stage,
        workflowType: WorkflowType.FULL,
        ticketNumber: num,
        ticketKey: `E2E-BF-${num}-${Date.now().toString().slice(-6)}`,
        updatedAt: new Date(),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: t.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        commitSha: `sha-bf-${num}`,
        qualityScore: 85,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return t.id;
  }

  async function seedShippedTicket(num: number): Promise<number> {
    return seedTicket(num, Stage.SHIP);
  }

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    // ctx.cleanup() deletes tickets (cascading their outcomes) but leaves
    // BackfillProgress alone — which would carry a stale cursor from the
    // previous test and cause runBackfill() to skip all tickets via id < cursor.
    await prisma.backfillProgress.deleteMany({ where: { projectId: ctx.projectId } });
    await prisma.project.update({
      where: { id: ctx.projectId },
      data: {
        config: {
          version: 1,
          project: { language: 'typescript' },
          services: [{ type: 'postgres' }],
          testing: { framework: 'vitest' },
        },
        configSyncedAt: new Date(),
      },
    });
  });

  it('idempotent: first run writes N rows, second run writes 0 (T031, T035)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/foo.ts', additions: 5, deletions: 1 },
    ]);

    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(await seedShippedTicket(600 + i));
    }

    // First run
    await runBackfill({ projectId: ctx.projectId, resumeCursor: null });
    const after1 = await prisma.ticketOutcome.count({ where: { projectId: ctx.projectId } });
    expect(after1).toBe(5);
    const progress1 = await prisma.backfillProgress.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(progress1?.status).toBe('COMPLETED');
    expect(progress1?.ticketsProcessed).toBe(5);

    // Second run — no-op
    await runBackfill({ projectId: ctx.projectId, resumeCursor: null });
    const after2 = await prisma.ticketOutcome.count({ where: { projectId: ctx.projectId } });
    expect(after2).toBe(5);
  });

  it('partial rows for tickets whose commit fetch fails (T033)', async () => {
    const okId = await seedShippedTicket(610);
    const failId = await seedShippedTicket(611);

    const original = githubFiles.fetchCommitFiles;
    vi.spyOn(githubFiles, 'fetchCommitFiles').mockImplementation(async (params) => {
      if (params.shas.includes(`sha-bf-611`)) {
        return { files: [], successfulShas: [], notFoundShas: [], failure: 'fetch_failed_after_retry' };
      }
      return original.call(githubFiles, params);
    });

    await runBackfill({ projectId: ctx.projectId, resumeCursor: null });

    const okRow = await prisma.ticketOutcome.findUnique({ where: { ticketId: okId } });
    const failRow = await prisma.ticketOutcome.findUnique({ where: { ticketId: failId } });
    expect(okRow!.partial).toBe(false);
    expect(failRow!.partial).toBe(true);
    expect(failRow!.partialReason).toBe('fetch_failed_after_retry');
  });

  it('excludes CLOSED tickets: backfill never captures outcomes for tickets in stage CLOSED (AIB-747)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/foo.ts', additions: 5, deletions: 1 },
    ]);

    const shipId = await seedShippedTicket(630);
    const closedId = await seedTicket(631, Stage.CLOSED);

    await runBackfill({ projectId: ctx.projectId, resumeCursor: null });

    const shipRow = await prisma.ticketOutcome.findUnique({ where: { ticketId: shipId } });
    const closedRow = await prisma.ticketOutcome.findUnique({ where: { ticketId: closedId } });
    expect(shipRow).not.toBeNull();
    expect(closedRow).toBeNull();

    const progress = await prisma.backfillProgress.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(progress?.status).toBe('COMPLETED');
    expect(progress?.ticketsProcessed).toBe(1);
  });

  it('CLOSED tickets interleaved with SHIP do not affect SHIP enumeration (AIB-747)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/foo.ts', additions: 5, deletions: 1 },
    ]);

    // Seed SHIP / CLOSED / SHIP. With the bug, ticketsProcessed would be 3
    // and the cursor would have walked past the CLOSED ticket. With the fix,
    // CLOSED is filtered at the query level — only the two SHIP tickets are
    // enumerated and processed.
    const shipA = await seedShippedTicket(640);
    await seedTicket(641, Stage.CLOSED);
    const shipB = await seedShippedTicket(642);

    await runBackfill({ projectId: ctx.projectId, resumeCursor: null });

    expect(await prisma.ticketOutcome.findUnique({ where: { ticketId: shipA } })).not.toBeNull();
    expect(await prisma.ticketOutcome.findUnique({ where: { ticketId: shipB } })).not.toBeNull();

    const progress = await prisma.backfillProgress.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(progress?.ticketsProcessed).toBe(2);
  });

  it('concurrent live capture during backfill: exactly one row per ticket (T034)', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/foo.ts', additions: 5, deletions: 1 },
    ]);

    const ticketId = await seedShippedTicket(620);

    // Race: live capture and backfill both target the same ticket.
    const [liveResult, _backfillResult] = await Promise.all([
      captureOutcomeOnShip({
        ticketId,
        projectId: ctx.projectId,
        workflowType: WorkflowType.FULL,
        shippedAt: new Date(),
      }),
      runBackfill({ projectId: ctx.projectId, resumeCursor: null }),
    ]);

    void liveResult;
    const rows = await prisma.ticketOutcome.findMany({
      where: { ticketId },
    });
    expect(rows).toHaveLength(1);
  });
});

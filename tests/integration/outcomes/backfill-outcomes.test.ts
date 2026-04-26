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

  async function seedShippedTicket(num: number): Promise<number> {
    const t = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: `[e2e] backfill ${num}`,
        description: 'x',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: num,
        ticketKey: `E2E-BF-${num}-${Date.now()}`,
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

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
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

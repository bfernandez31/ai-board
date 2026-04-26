/**
 * Integration test for backfill resume (T032 — US3 #4).
 *
 * Seed 10 tickets, simulate interruption after 4 are processed by setting
 * BackfillProgress.lastProcessedTicketId to the 4-th id, then re-invoke
 * runBackfill and assert only the remaining 6 tickets gain outcome rows.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { runBackfill } from '@/scripts/backfill-outcomes';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

afterEach(() => {
  delete process.env.TEST_OUTCOME_FILES;
});

describe('Backfill resume from cursor (US3 #4)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

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

  it('resumes from lastProcessedTicketId and only processes the remaining tickets', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/foo.ts', additions: 1, deletions: 0 },
    ]);

    // Seed 10 SHIP tickets in increasing id order
    const ids: number[] = [];
    for (let i = 0; i < 10; i++) {
      const t = await prisma.ticket.create({
        data: {
          projectId: ctx.projectId,
          title: `[e2e] resume ${i}`,
          description: 'x',
          stage: Stage.SHIP,
          workflowType: WorkflowType.FULL,
          ticketNumber: 700 + i,
          ticketKey: `E2E-RES-${i}-${Date.now()}`,
          updatedAt: new Date(),
        },
      });
      await prisma.job.create({
        data: {
          ticketId: t.id,
          projectId: ctx.projectId,
          command: 'verify',
          status: JobStatus.COMPLETED,
          commitSha: `sha-res-${i}`,
          qualityScore: 80,
          startedAt: new Date(),
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      ids.push(t.id);
    }
    // tickets are processed in id-DESC order; pretend we already got the top 4 ids done.
    const desc = [...ids].sort((a, b) => b - a);
    const firstFourIds = desc.slice(0, 4); // already processed (newest first)
    const remainingIds = desc.slice(4); // 6 left

    // Pre-populate outcomes for the first four (simulating interruption after 4 done).
    for (const id of firstFourIds) {
      await prisma.ticketOutcome.create({
        data: {
          ticketId: id,
          projectId: ctx.projectId,
          workflowType: WorkflowType.FULL,
          shippedAt: new Date(),
          ruleSetVersion: 1,
        },
      });
    }
    // Set the resume cursor at the 4-th id (smallest of the four already-done ids).
    const cursor = firstFourIds[firstFourIds.length - 1]!;
    await prisma.backfillProgress.create({
      data: {
        projectId: ctx.projectId,
        status: 'IN_PROGRESS',
        lastProcessedTicketId: cursor,
        ticketsProcessed: 4,
      },
    });

    await runBackfill({ projectId: ctx.projectId, resumeCursor: cursor });

    const total = await prisma.ticketOutcome.count({ where: { projectId: ctx.projectId } });
    expect(total).toBe(10);
    for (const id of remainingIds) {
      const row = await prisma.ticketOutcome.findUnique({ where: { ticketId: id } });
      expect(row).not.toBeNull();
    }
    const progress = await prisma.backfillProgress.findUnique({
      where: { projectId: ctx.projectId },
    });
    expect(progress?.status).toBe('COMPLETED');
  });
});

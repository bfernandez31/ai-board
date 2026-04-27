/**
 * Integration tests for outcome immutability (T016, US1 #5; SC-008).
 *
 * After a row is written, every subsequent capture call for the same ticket must be
 * a byte-identical no-op — no mutation, no error.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { captureOutcomeOnShip } from '@/lib/outcomes/capture';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

afterEach(() => {
  delete process.env.TEST_OUTCOME_FILES;
});

describe('Outcome immutability (US1 #5)', () => {
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
          project: { name: 't', language: 'typescript' },
          services: [{ type: 'postgres' }],
          testing: { framework: 'vitest' },
        },
        configSyncedAt: new Date(),
      },
    });
  });

  it('second capture on the same ticket leaves the row byte-identical', async () => {
    process.env.TEST_OUTCOME_FILES = JSON.stringify([
      { filename: 'app/foo.ts', additions: 10, deletions: 1 },
    ]);

    const ticket = await prisma.ticket.create({
      data: {
        projectId: ctx.projectId,
        title: '[e2e] immutability test',
        description: 'x',
        stage: Stage.SHIP,
        workflowType: WorkflowType.FULL,
        ticketNumber: 200,
        ticketKey: `E2E-IMM-${Date.now()}`,
        updatedAt: new Date(),
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        commitSha: 'sha-imm',
        qualityScore: 85,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const first = await captureOutcomeOnShip({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });
    expect(first.status).toBe('created');

    const rowBefore = await prisma.ticketOutcome.findUnique({ where: { ticketId: ticket.id } });
    expect(rowBefore).not.toBeNull();

    const second = await captureOutcomeOnShip({
      ticketId: ticket.id,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      shippedAt: new Date(),
    });
    expect(second.status).toBe('duplicate');

    const rowAfter = await prisma.ticketOutcome.findUnique({ where: { ticketId: ticket.id } });
    expect(rowAfter).toEqual(rowBefore);
  });
});

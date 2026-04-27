/**
 * Integration test for T019 (US1, FR-019, SC-007):
 * "SHIP completes within budget when outcome capture rejects."
 *
 * The fire-and-forget captureOutcomeOnShip in lib/tickets/transition.ts must NOT propagate
 * its failures back to the SHIP response. We verify this by stubbing the capture function
 * to reject and asserting the SHIP transition still returns 200 with stage=SHIP.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus, Stage, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import * as captureModule from '@/lib/outcomes/capture';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SHIP transition is resilient to capture failure (T019, FR-019)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('returns 200 even when captureOutcomeOnShip throws', async () => {
    const captureSpy = vi
      .spyOn(captureModule, 'captureOutcomeOnShip')
      .mockRejectedValueOnce(new Error('boom'));

    // Build a ticket in VERIFY stage with COMPLETED jobs ready for SHIP.
    const create = await ctx.api.post<{ id: number }>(
      `/api/projects/${ctx.projectId}/tickets`,
      {
        title: '[e2e] capture resilience',
        description: 'x',
      }
    );
    expect(create.status).toBe(201);
    const ticketId = create.data.id;

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        stage: Stage.VERIFY,
        workflowType: WorkflowType.FULL,
        version: { increment: 4 },
      },
    });
    await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        qualityScore: 85,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const res = await ctx.api.post<{ stage: string }>(
      `/api/projects/${ctx.projectId}/tickets/${ticketId}/transition`,
      { targetStage: 'SHIP' }
    );

    expect(res.status).toBe(200);
    expect(res.data.stage).toBe('SHIP');

    // The fire-and-forget call ran (and rejected) — the response was returned regardless.
    // The mocked rejection was caught by the .catch() in transition.ts.
    expect(captureSpy).toHaveBeenCalled();

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket?.stage).toBe(Stage.SHIP);
  });
});

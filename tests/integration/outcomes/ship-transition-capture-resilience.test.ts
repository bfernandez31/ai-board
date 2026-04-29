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
import { executeTicketTransition } from '@/lib/tickets/transition';

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
    // We call executeTicketTransition() directly (in-process) instead of going
    // through the HTTP API, so vi.spyOn actually intercepts the captureModule
    // import — a spy applied here would never reach a separate dev-server
    // process bound to port 3000.
    const captureSpy = vi
      .spyOn(captureModule, 'captureOutcomeOnShip')
      .mockRejectedValueOnce(new Error('boom'));

    // Build a ticket in VERIFY stage with COMPLETED jobs ready for SHIP.
    const ticket = await ctx.createTicket({
      title: '[e2e] capture resilience',
      description: 'x',
    });

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: Stage.VERIFY,
        workflowType: WorkflowType.FULL,
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        qualityScore: 85,
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const result = await executeTicketTransition(
      ctx.projectId,
      String(ticket.id),
      Stage.SHIP
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    if (result.ok) {
      expect(result.body.stage).toBe('SHIP');
    }

    // The fire-and-forget call ran (and rejected) — the result was returned regardless.
    // The mocked rejection was caught by the .catch() in transition.ts.
    expect(captureSpy).toHaveBeenCalled();

    const persisted = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(persisted?.stage).toBe(Stage.SHIP);
  });
});

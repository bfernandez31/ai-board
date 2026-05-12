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
import * as calibrationModule from '@/lib/calibration/pair';
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

  it('SHIP returns 200 even when pairCalibrationOnOutcome rejects (T010, US2)', async () => {
    // Stub capture so the fire-and-forget chain deterministically reaches
    // pairCalibrationOnOutcome — without this, the real capture path may
    // short-circuit or take longer than any fixed sleep.
    vi.spyOn(captureModule, 'captureOutcomeOnShip').mockResolvedValueOnce({
      status: 'created',
      partial: false,
      partialReason: null,
      durationMs: 0,
    });
    const calibrationSpy = vi
      .spyOn(calibrationModule, 'pairCalibrationOnOutcome')
      .mockRejectedValueOnce(new Error('calibration boom'));

    const ticket = await ctx.createTicket({
      title: '[e2e] cal resilience reject',
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

    // Poll for the fire-and-forget chain to settle (capture + pair).
    await vi.waitFor(() => expect(calibrationSpy).toHaveBeenCalled(), {
      timeout: 2000,
      interval: 25,
    });

    const persisted = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(persisted?.stage).toBe(Stage.SHIP);
  });

  it('SHIP returns 200 with no calibration row when ticket has no success analysis (T010, US2)', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] cal no-success',
      description: 'x',
    });
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        stage: Stage.VERIFY,
        workflowType: WorkflowType.FULL,
        branch: 'no-success-branch',
      },
    });
    await prisma.job.create({
      data: {
        ticketId: ticket.id,
        projectId: ctx.projectId,
        command: 'verify',
        status: JobStatus.COMPLETED,
        qualityScore: 80,
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

    // Wait briefly for the fire-and-forget chain to settle.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const calibration = await prisma.analysisCalibration.findUnique({
      where: { ticketId: ticket.id },
    });
    expect(calibration).toBeNull();
  });
});

// AIB-791 T021: predicate count vs list agreement across a mixed-agent window.
import {
  countShippedClaudeTicketsSince,
  listShippedClaudeJobsForWindow,
} from '@/app/lib/insights/predicate';

describe('insights predicate: count vs list agreement (AIB-791 T021)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('countShippedClaudeTicketsSince agrees with listShippedClaudeJobsForWindow for a mixed-agent window', async () => {
    const windowStart = new Date('2026-05-01T00:00:00Z');
    const windowEnd = new Date('2026-05-12T00:00:00Z');

    // Three tickets: (Claude+ticket-agent), (Claude+project-default),
    // (Codex+ticket-agent) shipped inside the window.
    const tCla = await ctx.createTicket({ title: '[e2e] claude-ticket-agent', description: 'x' });
    const tInh = await ctx.createTicket({ title: '[e2e] claude-project-default', description: 'x' });
    const tCod = await ctx.createTicket({ title: '[e2e] codex-ticket-agent', description: 'x' });

    await prisma.ticket.update({ where: { id: tCla.id }, data: { agent: 'CLAUDE' } });
    await prisma.ticket.update({ where: { id: tInh.id }, data: { agent: null } });
    await prisma.ticket.update({ where: { id: tCod.id }, data: { agent: 'CODEX' } });
    await prisma.project.update({ where: { id: ctx.projectId }, data: { defaultAgent: 'CLAUDE' } });

    const baseOutcome = {
      workflowType: WorkflowType.FULL,
      ruleSetVersion: 1,
      projectId: ctx.projectId,
    };
    for (const ticket of [tCla, tInh, tCod]) {
      await prisma.job.create({
        data: {
          ticketId: ticket.id,
          projectId: ctx.projectId,
          command: 'implement',
          status: JobStatus.COMPLETED,
          startedAt: new Date('2026-05-05T00:00:00Z'),
          completedAt: new Date('2026-05-05T00:30:00Z'),
          updatedAt: new Date('2026-05-05T00:30:00Z'),
        },
      });
      await prisma.ticketOutcome.create({
        data: {
          ...baseOutcome,
          ticketId: ticket.id,
          shippedAt: new Date('2026-05-05T01:00:00Z'),
        },
      });
    }

    const count = await countShippedClaudeTicketsSince(windowStart);
    const list = await listShippedClaudeJobsForWindow(windowStart, windowEnd);

    expect(count).toBe(2);
    expect(new Set(list.map((j) => j.ticketId))).toEqual(new Set([tCla.id, tInh.id]));
    expect(list.every((j) => j.rawArtifactKey.startsWith('raw-logs/'))).toBe(true);
  });
});

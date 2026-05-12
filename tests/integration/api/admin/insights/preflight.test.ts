import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { requireAdminOrNotFound } = vi.hoisted(() => ({
  requireAdminOrNotFound: vi.fn(),
}));

vi.mock('@/app/lib/auth/admin', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, requireAdminOrNotFound };
});

import { GET } from '@/app/api/admin/insights/preflight/route';

interface PreflightResponse {
  canTrigger: boolean;
  shippedSincePreviousRun: number;
  previousRunEnd: string | null;
  runningSince: string | null;
  refusal: { refusalCode: string; message: string } | null;
}

async function seedClaudeShip(ctx: TestContext, at: Date) {
  const prisma = getPrismaClient();
  const ticket = await ctx.createTicket({ title: '[e2e] pf-ship' });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { agent: 'CLAUDE' } });
  await prisma.project.update({ where: { id: ctx.projectId }, data: { defaultAgent: 'CLAUDE' } });
  const job = await prisma.job.create({
    data: {
      ticketId: ticket.id,
      projectId: ctx.projectId,
      command: 'implement',
      status: JobStatus.COMPLETED,
      startedAt: at,
      completedAt: at,
      updatedAt: at,
    },
  });
  // Predicate gates on JobLog.rawArtifactKey — the analyzable corpus is the
  // set of sessions the workflow can actually fetch via /raw-native.
  await prisma.jobLog.create({
    data: {
      jobId: job.id,
      captureStatus: 'CAPTURED',
      preview: '',
      rawArtifactKey: `raw-logs/${ctx.projectId}/${ticket.id}/${job.id}.jsonl.gz`,
      rawArtifactSize: 1,
    },
  });
  await prisma.ticketOutcome.create({
    data: {
      ticketId: ticket.id,
      projectId: ctx.projectId,
      workflowType: WorkflowType.FULL,
      ruleSetVersion: 1,
      shippedAt: at,
    },
  });
}

describe('GET /api/admin/insights/preflight (US3)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    requireAdminOrNotFound.mockReset();
    await prisma.insightsReport.deleteMany({});
  });

  it('returns 404 for non-admin', async () => {
    requireAdminOrNotFound.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    });
    const res = await GET(new NextRequest('http://localhost/api/admin/insights/preflight'));
    expect(res.status).toBe(404);
  });

  it('canTrigger=true with shipped count when there are new ships', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'a@e2e.local' });
    await seedClaudeShip(ctx, new Date());
    const res = await GET(new NextRequest('http://localhost/api/admin/insights/preflight'));
    const body = (await res.json()) as PreflightResponse;
    expect(body.canTrigger).toBe(true);
    expect(body.shippedSincePreviousRun).toBe(1);
    expect(body.refusal).toBeNull();
  });

  it('canTrigger=false with ALREADY_RUNNING when a RUNNING row exists', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'a@e2e.local' });
    await seedClaudeShip(ctx, new Date());
    await prisma.insightsReport.create({
      data: {
        status: 'RUNNING',
        generatedAt: new Date(),
        periodStart: new Date(Date.now() - 60_000),
        periodEnd: new Date(),
      },
    });
    const res = await GET(new NextRequest('http://localhost/api/admin/insights/preflight'));
    const body = (await res.json()) as PreflightResponse;
    expect(body.canTrigger).toBe(false);
    expect(body.runningSince).not.toBeNull();
    expect(body.refusal?.refusalCode).toBe('ALREADY_RUNNING');
  });
});

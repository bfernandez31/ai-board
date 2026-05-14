import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus, WorkflowType } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';

const { requireAdminOrNotFound, isWorkflowTestMode } = vi.hoisted(() => ({
  requireAdminOrNotFound: vi.fn(),
  isWorkflowTestMode: vi.fn(),
}));

vi.mock('@/app/lib/auth/admin', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, requireAdminOrNotFound };
});

vi.mock('@/app/lib/workflows/test-mode', () => ({
  isWorkflowTestMode,
}));

import { POST } from '@/app/api/admin/insights/trigger/route';

function makeRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/admin/insights/trigger', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

async function seedShippedClaudeTicket(ctx: TestContext, when: Date) {
  const prisma = getPrismaClient();
  const ticket = await ctx.createTicket({ title: '[e2e] shipped' });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { agent: 'CLAUDE' } });
  await prisma.project.update({ where: { id: ctx.projectId }, data: { defaultAgent: 'CLAUDE' } });
  const job = await prisma.job.create({
    data: {
      ticketId: ticket.id,
      projectId: ctx.projectId,
      command: 'implement',
      status: JobStatus.COMPLETED,
      startedAt: when,
      completedAt: when,
      updatedAt: when,
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
      shippedAt: when,
    },
  });
  return ticket;
}

describe('POST /api/admin/insights/trigger (US3, AIB-791)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    requireAdminOrNotFound.mockReset();
    isWorkflowTestMode.mockReset();
    isWorkflowTestMode.mockReturnValue(true);
    await prisma.insightsReport.deleteMany({});
  });

  it('returns 404 byte-equivalent to a non-admin caller', async () => {
    requireAdminOrNotFound.mockResolvedValue({
      ok: false,
      response: new Response(null, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }),
    });
    const res = await POST(makeRequest());
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });

  it('refuses with NO_CLAUDE_JOBS when no Claude jobs have ever shipped', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });
    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { refusalCode: string; message: string };
    expect(body.refusalCode).toBe('NO_CLAUDE_JOBS');
  });

  it('refuses with NO_NEW_SHIPPED when last run already covered everything', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const earlier = new Date('2026-05-01T00:00:00Z');
    await seedShippedClaudeTicket(ctx, earlier);

    // Last completed run already covered through "now" — periodEnd > shippedAt
    const later = new Date('2026-05-02T00:00:00Z');
    await prisma.insightsReport.create({
      data: {
        status: 'COMPLETED',
        generatedAt: later,
        periodStart: new Date('2026-04-01T00:00:00Z'),
        periodEnd: later,
        sessionsCount: 1,
        ticketsCount: 1,
        artifactKey: 'insights/reports/seed.html',
        artifactSize: 1,
        completedAt: later,
      },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { refusalCode: string; message: string };
    expect(body.refusalCode).toBe('NO_NEW_SHIPPED');
  });

  it('refuses with ALREADY_RUNNING when a RUNNING row already exists', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });
    await seedShippedClaudeTicket(ctx, new Date());

    await prisma.insightsReport.create({
      data: {
        status: 'RUNNING',
        generatedAt: new Date(),
        periodStart: new Date(Date.now() - 60_000),
        periodEnd: new Date(),
      },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(409);
    const body = (await res.json()) as { refusalCode: string };
    expect(body.refusalCode).toBe('ALREADY_RUNNING');
  });

  it('creates a RUNNING row + Job in a single transaction on accept', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });
    await seedShippedClaudeTicket(ctx, new Date());

    const res = await POST(makeRequest());
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number; status: string };
    expect(body.status).toBe('RUNNING');

    const row = await prisma.insightsReport.findUnique({ where: { id: body.id } });
    expect(row?.status).toBe('RUNNING');
    expect(row?.jobId).not.toBeNull();

    const job = await prisma.job.findUnique({ where: { id: row!.jobId! } });
    expect(job?.command).toBe('insights-analyze');
    expect(job?.ticketId).toBeNull();
  });

  it('retry with valid period params creates a new report (201)', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const res = await POST(
      makeRequest({
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-05-10T00:00:00.000Z',
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: number; status: string };
    expect(body.status).toBe('RUNNING');

    const row = await prisma.insightsReport.findUnique({ where: { id: body.id } });
    expect(row?.status).toBe('RUNNING');
    expect(row?.periodStart.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(row?.periodEnd.toISOString()).toBe('2026-05-10T00:00:00.000Z');
  });

  it('retry with mismatched params (one missing) returns 400', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const res = await POST(
      makeRequest({ periodStart: '2026-05-01T00:00:00.000Z' })
    );
    expect(res.status).toBe(400);
  });

  it('retry with periodStart >= periodEnd returns 400', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    const res = await POST(
      makeRequest({
        periodStart: '2026-05-10T00:00:00.000Z',
        periodEnd: '2026-05-01T00:00:00.000Z',
      })
    );
    expect(res.status).toBe(400);
  });

  it('retry is still blocked by ALREADY_RUNNING gate (409)', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'admin@e2e.local' });

    await prisma.insightsReport.create({
      data: {
        status: 'RUNNING',
        generatedAt: new Date(),
        periodStart: new Date(Date.now() - 60_000),
        periodEnd: new Date(),
      },
    });

    const res = await POST(
      makeRequest({
        periodStart: '2026-05-01T00:00:00.000Z',
        periodEnd: '2026-05-10T00:00:00.000Z',
      })
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { refusalCode: string };
    expect(body.refusalCode).toBe('ALREADY_RUNNING');
  });
});

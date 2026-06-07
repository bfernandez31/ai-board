import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobStatus } from '@prisma/client';
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
  analyzableSessions: number;
  expectedSessions: number;
  previousRunEnd: string | null;
  runningSince: string | null;
  refusal: { refusalCode: string; message: string } | null;
}

async function seedClaudeSession(
  ctx: TestContext,
  at: Date,
  opts: { analyzable?: boolean } = {}
) {
  const prisma = getPrismaClient();
  const ticket = await ctx.createTicket({ title: '[e2e] pf-session' });
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
  // AIB-852: selection is decoupled from SHIP — no TicketOutcome needed. The
  // predicate gates analyzable sessions on JobLog.captureStatus='CAPTURED' +
  // rawArtifactKey != null (the set the workflow can actually fetch).
  const analyzable = opts.analyzable ?? true;
  await prisma.jobLog.create({
    data: {
      jobId: job.id,
      captureStatus: analyzable ? 'CAPTURED' : 'UNAVAILABLE',
      preview: '',
      rawArtifactKey: analyzable
        ? `raw-logs/${ctx.projectId}/${ticket.id}/${job.id}.jsonl.gz`
        : null,
      rawArtifactSize: analyzable ? 1 : null,
    },
  });
  return { ticket, job };
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

  it('canTrigger=true with session counts when there are analyzable sessions', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'a@e2e.local' });
    await seedClaudeSession(ctx, new Date());
    const res = await GET(new NextRequest('http://localhost/api/admin/insights/preflight'));
    const body = (await res.json()) as PreflightResponse;
    expect(body.canTrigger).toBe(true);
    expect(body.analyzableSessions).toBe(1);
    expect(body.expectedSessions).toBe(1);
    expect(body.refusal).toBeNull();
  });

  it('refuses with NO_CLAUDE_SESSIONS on an empty corpus (no prior run)', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'a@e2e.local' });
    const res = await GET(new NextRequest('http://localhost/api/admin/insights/preflight'));
    const body = (await res.json()) as PreflightResponse;
    expect(body.canTrigger).toBe(false);
    expect(body.analyzableSessions).toBe(0);
    expect(body.refusal?.refusalCode).toBe('NO_CLAUDE_SESSIONS');
  });

  it('refuses with NO_NEW_SESSIONS when a prior run exists and nothing is analyzable', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'a@e2e.local' });
    // A transcript-pending session is expected but not analyzable (FR-011).
    await seedClaudeSession(ctx, new Date(), { analyzable: false });
    const past = new Date('2026-05-01T00:00:00Z');
    await prisma.insightsReport.create({
      data: {
        status: 'COMPLETED',
        generatedAt: past,
        periodStart: new Date('2026-04-01T00:00:00Z'),
        periodEnd: past,
        sessionsCount: 0,
        expectedSessionsCount: 0,
        ticketsCount: 0,
        artifactKey: 'insights/reports/seed.html',
        artifactSize: 1,
        completedAt: past,
      },
    });
    const res = await GET(new NextRequest('http://localhost/api/admin/insights/preflight'));
    const body = (await res.json()) as PreflightResponse;
    expect(body.canTrigger).toBe(false);
    expect(body.analyzableSessions).toBe(0);
    expect(body.expectedSessions).toBe(1);
    expect(body.refusal?.refusalCode).toBe('NO_NEW_SESSIONS');
  });

  it('canTrigger=false with ALREADY_RUNNING when a RUNNING row exists', async () => {
    requireAdminOrNotFound.mockResolvedValue({ ok: true, email: 'a@e2e.local' });
    await seedClaudeSession(ctx, new Date());
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

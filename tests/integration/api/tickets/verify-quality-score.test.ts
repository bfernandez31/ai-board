import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { PATCH } from '@/app/api/tickets/[id]/verify-quality-score/route';

const { validateWorkflowAuth } = vi.hoisted(() => ({
  validateWorkflowAuth: vi.fn(),
}));

vi.mock('@/app/lib/auth/workflow-auth', () => ({
  validateWorkflowAuth,
}));

describe('PATCH /api/tickets/:id/verify-quality-score', () => {
  let ctx: TestContext;
  let ticketId: number;
  const prisma = getPrismaClient();

  const sampleDetails = JSON.stringify({
    version: 1,
    qualityScore: 83,
    threshold: 'Good',
    dimensions: [
      { name: 'Bug Detection', agentId: 'bug-detection', score: 90, weight: 0.3, weightedScore: 27 },
    ],
    computedAt: '2026-05-13T10:30:00Z',
  });

  function buildRequest(body: unknown): NextRequest {
    return new NextRequest(
      `http://localhost/api/tickets/${ticketId}/verify-quality-score`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
  }

  function buildContext() {
    return { params: Promise.resolve({ id: String(ticketId) }) };
  }

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
    validateWorkflowAuth.mockReset();
    validateWorkflowAuth.mockReturnValue({ isValid: true });

    const ticket = await ctx.createTicket({ title: '[e2e] verify-quality-score' });
    ticketId = ticket.id;
  });

  it('returns 401 when workflow auth fails', async () => {
    validateWorkflowAuth.mockReturnValue({ isValid: false, error: 'nope' });

    const response = await PATCH(
      buildRequest({ qualityScore: 80, qualityScoreDetails: sampleDetails }),
      buildContext()
    );

    expect(response.status).toBe(401);
  });

  it('returns 404 when the ticket has no verify job', async () => {
    const response = await PATCH(
      buildRequest({ qualityScore: 80, qualityScoreDetails: sampleDetails }),
      buildContext()
    );

    expect(response.status).toBe(404);
    const data = (await response.json()) as { applied: boolean; reason: string };
    expect(data.applied).toBe(false);
    expect(data.reason).toBe('no_verify_job');
  });

  it('backfills qualityScore and qualityScoreDetails when the latest verify job has none', async () => {
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const response = await PATCH(
      buildRequest({ qualityScore: 83, qualityScoreDetails: sampleDetails }),
      buildContext()
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      applied: boolean;
      jobId: number;
      qualityScore: number;
    };
    expect(data).toEqual({ applied: true, jobId: job.id, qualityScore: 83 });

    const persisted = await prisma.job.findUnique({ where: { id: job.id } });
    expect(persisted?.qualityScore).toBe(83);
    expect(persisted?.qualityScoreDetails).toBe(sampleDetails);
  });

  it('is a no-op when the latest verify job already has a qualityScore', async () => {
    const job = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        startedAt: new Date(),
        completedAt: new Date(),
        updatedAt: new Date(),
        qualityScore: 91,
        qualityScoreDetails: '{"existing":true}',
      },
    });

    const response = await PATCH(
      buildRequest({ qualityScore: 50, qualityScoreDetails: sampleDetails }),
      buildContext()
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as {
      applied: boolean;
      reason: string;
      jobId: number;
      qualityScore: number;
    };
    expect(data.applied).toBe(false);
    expect(data.reason).toBe('already_set');
    expect(data.jobId).toBe(job.id);
    expect(data.qualityScore).toBe(91);

    const persisted = await prisma.job.findUnique({ where: { id: job.id } });
    expect(persisted?.qualityScore).toBe(91);
    expect(persisted?.qualityScoreDetails).toBe('{"existing":true}');
  });

  it('targets the most recent verify job when several exist', async () => {
    await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'FAILED',
        startedAt: new Date('2026-05-10T10:00:00Z'),
        completedAt: new Date('2026-05-10T10:05:00Z'),
        updatedAt: new Date(),
      },
    });
    const latest = await prisma.job.create({
      data: {
        ticketId,
        projectId: ctx.projectId,
        command: 'verify',
        status: 'COMPLETED',
        startedAt: new Date('2026-05-13T10:00:00Z'),
        completedAt: new Date('2026-05-13T10:05:00Z'),
        updatedAt: new Date(),
      },
    });

    const response = await PATCH(
      buildRequest({ qualityScore: 72, qualityScoreDetails: sampleDetails }),
      buildContext()
    );

    expect(response.status).toBe(200);
    const data = (await response.json()) as { applied: boolean; jobId: number };
    expect(data.applied).toBe(true);
    expect(data.jobId).toBe(latest.id);
  });

  it('rejects qualityScore outside the 0-100 range', async () => {
    const response = await PATCH(
      buildRequest({ qualityScore: 150, qualityScoreDetails: sampleDetails }),
      buildContext()
    );

    expect(response.status).toBe(400);
  });

  it('rejects invalid ticket id format', async () => {
    const response = await PATCH(
      new NextRequest('http://localhost/api/tickets/not-a-number/verify-quality-score', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualityScore: 80, qualityScoreDetails: sampleDetails }),
      }),
      { params: Promise.resolve({ id: 'not-a-number' }) }
    );

    expect(response.status).toBe(400);
  });
});

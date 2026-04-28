import { NextRequest } from 'next/server';
import { beforeEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Stage } from '@prisma/client';
import { getTestContext, type TestContext } from '@/tests/fixtures/vitest/setup';
import { getPrismaClient } from '@/tests/helpers/db-cleanup';
import { PATCH } from '@/app/api/projects/[projectId]/tickets/[id]/analysis/[analysisId]/status/route';
import { POST } from '@/app/api/projects/[projectId]/tickets/[id]/analysis/route';

beforeAll(() => {
  process.env.TEST_MODE = 'true';
});

vi.mock('@/lib/ai-credentials/workflow', () => ({
  getOwnerCredential: vi.fn(async () => ({ id: 1, userId: 'fake', provider: 'ANTHROPIC' })),
  getMissingCredentialError: () => 'No Anthropic credential.',
}));

vi.mock('@/lib/analysis/dispatch-analysis', () => ({
  dispatchInboxAnalysisWorkflow: vi.fn(async () => undefined),
}));

const WORKFLOW_TOKEN = process.env.WORKFLOW_API_TOKEN ?? 'test-workflow-token-for-e2e-tests-only';

describe('TicketAnalysis append-only invariant (SC-009)', () => {
  let ctx: TestContext;
  const prisma = getPrismaClient();

  beforeEach(async () => {
    ctx = await getTestContext();
    await ctx.cleanup();
  });

  it('refuses to mutate a terminal row via PATCH; re-analyze creates a new row', async () => {
    const ticket = await ctx.createTicket({
      title: '[e2e] append-only',
      description: 'add a thing',
      stage: Stage.INBOX,
    });

    const trigger1 = await POST(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...ctx.api.getHeaders() },
          body: '{}',
        }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticket.id),
        }),
      }
    );
    expect(trigger1.status).toBe(202);
    const triggered = (await trigger1.json()) as { analysis: { id: number } };
    const firstId = triggered.analysis.id;

    await PATCH(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis/${firstId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WORKFLOW_TOKEN}`,
          },
          body: JSON.stringify({
            status: 'success',
            output: {
              frictionRisk: 'low',
              qualityGateRange: { lower: 80, upper: 95 },
              recommendation: { choice: 'QUICK', confidence: 'medium', justification: 'OK' },
              costRange: { baselineLowerUsd: 0.05, baselineUpperUsd: 0.10, marginalFrictionLowerUsd: 0, marginalFrictionUpperUsd: 0.02 },
              scopeWarnings: [],
              anchors: [],
            },
            telemetry: { costUsd: 0.07, durationMs: 12000 },
          }),
        }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticket.id),
          analysisId: String(firstId),
        }),
      }
    );

    const after = await prisma.ticketAnalysis.findUnique({ where: { id: firstId } });
    expect(after?.status).toBe('success');
    const startedAt = after!.startedAt;
    const titleSnap = after!.titleSnapshot;
    const descSnap = after!.descriptionSnapshot;
    const createdAt = after!.createdAt;

    // Try to mutate via PATCH again
    await PATCH(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis/${firstId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${WORKFLOW_TOKEN}`,
          },
          body: JSON.stringify({ status: 'failed', errorReason: 'other' }),
        }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticket.id),
          analysisId: String(firstId),
        }),
      }
    );

    const stillSame = await prisma.ticketAnalysis.findUnique({ where: { id: firstId } });
    expect(stillSame?.status).toBe('success');
    expect(stillSame?.startedAt).toEqual(startedAt);
    expect(stillSame?.titleSnapshot).toBe(titleSnap);
    expect(stillSame?.descriptionSnapshot).toBe(descSnap);
    expect(stillSame?.createdAt).toEqual(createdAt);

    // Re-analyze creates a NEW row
    const trigger2 = await POST(
      new NextRequest(
        `http://localhost/api/projects/${ctx.projectId}/tickets/${ticket.id}/analysis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...ctx.api.getHeaders() },
          body: '{}',
        }
      ),
      {
        params: Promise.resolve({
          projectId: String(ctx.projectId),
          id: String(ticket.id),
        }),
      }
    );
    expect(trigger2.status).toBe(202);
    const triggered2 = (await trigger2.json()) as { analysis: { id: number } };
    expect(triggered2.analysis.id).not.toBe(firstId);

    const rows = await prisma.ticketAnalysis.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows).toHaveLength(2);
  });
});
